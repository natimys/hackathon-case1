$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\natim\Projects\hackathon-case1'
Set-Location -LiteralPath $repo

$firstSecure = Read-Host 'New password for demo.resident@example.com (hidden, 12+ chars)' -AsSecureString
$secondSecure = Read-Host 'Confirm new password (hidden)' -AsSecureString
$firstPtr = [IntPtr]::Zero
$secondPtr = [IntPtr]::Zero
$plain = $null
$confirmation = $null
$process = $null
try {
    $firstPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($firstSecure)
    $secondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secondSecure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPtr)
    $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPtr)
    if ($plain.Length -lt 12) { throw 'Password must contain at least 12 characters.' }
    if ($plain -cne $confirmation) { throw 'Passwords did not match.' }

    $python = @"
import asyncio
import sys
import httpx
from sqlalchemy import select
from core.security import hash_password
from core.settings import get_settings
from database.engine import create_engine_and_sessionmaker
from modules.users.models import User

EMAIL = 'demo.resident@example.com'

async def main():
    password = sys.stdin.readline().rstrip('\r\n')
    if not password:
        raise SystemExit('No password received; no database changes made.')
    settings = get_settings()
    if settings.ENVIRONMENT != 'development':
        raise SystemExit('Refusing to change password outside development.')
    new_hash = hash_password(password)
    engine, session_factory = create_engine_and_sessionmaker(settings.DATABASE_URL)
    old_hash = None
    try:
        async with session_factory() as db:
            users = (await db.scalars(select(User).where(User.email == EMAIL))).all()
            if len(users) != 1 or not users[0].is_active:
                raise SystemExit('Expected exactly one active existing demo user; no changes made.')
            user = users[0]
            old_hash = user.password
            user.password = new_hash
            await db.commit()
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                response = await client.post('http://127.0.0.1:8000/auth/mobile/login', json={'email': EMAIL, 'password': password})
            status = response.status_code
            body = response.json() if status == 200 else {}
            ok = bool(body.get('access_token') and body.get('refresh_token'))
        except Exception:
            status = 0
            ok = False
        if not ok:
            async with session_factory() as db:
                user = await db.scalar(select(User).where(User.email == EMAIL))
                if user is not None and user.password == new_hash:
                    user.password = old_hash
                    await db.commit()
                    print('password_reset=rolled_back')
                else:
                    print('password_reset=rollback_skipped_due_to_concurrent_change')
            print('mobile_login_http_status=' + str(status))
            raise SystemExit('Mobile login verification failed; response body and credentials were not logged.')
        print('password_reset=committed_for_existing_user_only')
        print('mobile_login_http_status=' + str(status))
        print('mobile_token_pair_valid=True')
    finally:
        await engine.dispose()

asyncio.run(main())
"@

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = 'docker'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($argument in @('compose', 'exec', '-T', 'backend', 'python', '-c', $python)) { [void]$psi.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    if (-not $process.Start()) { throw 'Could not start Docker Compose.' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.WriteLine($plain)
    $process.StandardInput.Close()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($stdout) { Write-Output $stdout.TrimEnd() }
    if ($stderr) { [Console]::Error.WriteLine($stderr.TrimEnd()) }
    if ($process.ExitCode -ne 0) { throw "Reset/HTTP verification failed with exit code $($process.ExitCode). See safe status output above." }
}
finally {
    $plain = $null
    $confirmation = $null
    if ($firstPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPtr) }
    if ($secondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPtr) }
    if ($firstSecure) { $firstSecure.Dispose() }
    if ($secondSecure) { $secondSecure.Dispose() }
    if ($process) { $process.Dispose() }
}
