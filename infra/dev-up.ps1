param(
    [switch]$NoBuild
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI was not found. Install Docker Desktop or add docker.exe to PATH."
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose is unavailable. Update Docker Desktop and retry."
}

$dotenvPath = Join-Path $repoRoot ".env"
if (-not (Test-Path -LiteralPath $dotenvPath -PathType Leaf)) {
    throw "Missing .env. Copy .env.example to .env, set unique development secrets, and retry."
}

$dotenvEnvironment = $null
foreach ($line in Get-Content -LiteralPath $dotenvPath) {
    if ($line -match '^\s*ENVIRONMENT\s*=\s*([^#\s]+)') {
        $dotenvEnvironment = $Matches[1].Trim('"', "'").ToLowerInvariant()
        break
    }
}
$runtimeEnvironment = if ($env:ENVIRONMENT) {
    $env:ENVIRONMENT.ToLowerInvariant()
} elseif ($dotenvEnvironment) {
    $dotenvEnvironment
} else {
    "development"
}
if ($runtimeEnvironment -notin @("development", "test")) {
    throw "Refusing to start the development launcher with ENVIRONMENT=$runtimeEnvironment."
}

$daemonInfo = docker info --format "{{.ServerVersion}}" 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Docker daemon is unavailable: $daemonInfo. Start Docker Desktop as the current user and retry from a normal PowerShell terminal. This launcher does not elevate or change permissions."
}

if ($NoBuild) {
    docker compose up -d
} else {
    docker compose up -d --build
}
if ($LASTEXITCODE -ne 0) {
    throw "Compose could not start the development services. Review the output above."
}

$deadline = (Get-Date).AddMinutes(2)
$requiredServices = @("db", "backend", "frontend")
do {
    $ready = $true
    foreach ($service in $requiredServices) {
        $containerId = docker compose ps -q $service
        if ($LASTEXITCODE -ne 0 -or -not $containerId) {
            $ready = $false
            break
        }
        $state = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerId
        if ($LASTEXITCODE -ne 0 -or $state.Trim() -ne "healthy") {
            $ready = $false
            break
        }
    }
    if ($ready) { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

if (-not $ready) {
    docker compose ps
    throw "Services did not become healthy within two minutes. Existing volumes were left untouched."
}

try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:9997/v3/paths/list" -TimeoutSec 3
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:9998/metrics" -TimeoutSec 3 -UseBasicParsing
} catch {
    throw "MediaMTX Control API or metrics endpoint is unavailable. Review 'docker compose logs mediamtx'."
}

docker compose ps
Write-Host "Development services are ready. Demo seed is intentionally a separate manual command; see README.md."
