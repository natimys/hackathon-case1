param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("single", "quad", "load50", "stop", "status")]
  [string]$Profile,
  [string]$Ffmpeg = "ffmpeg",
  [string]$HostAddress = "127.0.0.1"
)

$ErrorActionPreference = "Stop"
$root = Join-Path $env:TEMP "yakutsk-home-camera-simulator"
$manifest = Join-Path $root "processes.json"

function Get-VerifiedProcesses {
  if (-not (Test-Path -LiteralPath $manifest)) { return @() }
  $entries = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
  $active = @()
  foreach ($entry in $entries) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.pid)" -ErrorAction SilentlyContinue
    if ($proc -and $proc.Name -match "^ffmpeg(\.exe)?$" -and $proc.CommandLine -like "*$($entry.url)*") {
      $active += $entry
    }
  }
  return $active
}

if ($Profile -in @("stop", "status")) {
  $active = @(Get-VerifiedProcesses)
  if ($Profile -eq "stop") {
    foreach ($entry in $active) { Stop-Process -Id ([int]$entry.pid) -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $manifest -Force -ErrorAction SilentlyContinue
    Write-Output "Stopped $($active.Count) simulator-owned RTSP sources."
  } else {
    Write-Output "Active simulator-owned RTSP sources: $($active.Count)"
  }
  exit 0
}

$ffmpegCommand = Get-Command $Ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCommand) { throw "FFmpeg was not found. Install FFmpeg or pass -Ffmpeg <path>." }
$count = switch ($Profile) { single { 1 } quad { 4 } load50 { 50 } }
if ($Profile -eq "load50") {
  Write-Warning "load50 starts 50 CPU-encoded FFmpeg publishers. This can heavily load CPU, RAM, and network. Run only on a test host."
}
if ((Get-VerifiedProcesses).Count -gt 0) {
  throw "Simulator sources are already running. Stop them with infra/camera-simulator.ps1 stop before starting another profile."
}

New-Item -ItemType Directory -Path $root -Force | Out-Null
$entries = @()
 $startedProcesses = @()
try {
  for ($i = 1; $i -le $count; $i++) {
    $path = "demo/camera-{0:D3}" -f $i
    $url = "rtsp://$HostAddress`:8554/$path"
    $arguments = @(
      "-hide_banner", "-loglevel", "error", "-nostdin", "-re",
      "-f", "lavfi", "-i", "testsrc=size=320x180:rate=8",
      "-an", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
      "-threads", "1", "-g", "8", "-keyint_min", "8", "-sc_threshold", "0",
      "-pix_fmt", "yuv420p", "-f", "rtsp", "-rtsp_transport", "tcp", $url
    )
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $ffmpegCommand.Source
    foreach ($argument in $arguments) { $start.ArgumentList.Add([string]$argument) }
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::new()
    $proc.StartInfo = $start
    $null = $proc.Start()
    $startedProcesses += $proc
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()
    $entries += [pscustomobject]@{ pid = $proc.Id; url = $url }
  }
  $entries | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding utf8
} catch {
  foreach ($proc in $startedProcesses) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Remove-Item -LiteralPath $manifest -Force -ErrorAction SilentlyContinue
  throw
}
Write-Output "Started $count RTSP source(s) for profile '$Profile'. Check MediaMTX and Camera API status for actual readiness."
