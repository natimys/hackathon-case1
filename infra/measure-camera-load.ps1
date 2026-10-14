param(
  [ValidateRange(5, 3600)] [int]$DurationSeconds = 30,
  [ValidateSet("standalone", "compose")] [string]$Mode = "standalone"
)

$ErrorActionPreference = "Stop"
$metricsUrl = "http://127.0.0.1:9998/metrics"
$pathsUrl = "http://127.0.0.1:9997/v3/paths/list"

function Read-MetricSum([string]$Text, [string]$Name) {
  $sum = 0.0
  foreach ($line in ($Text -split "`n")) {
    if ($line -match "^$([regex]::Escape($Name))(?:\{[^}]*\})?\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*$") {
      $sum += [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
    }
  }
  return $sum
}

function Read-Snapshot {
  $metrics = (Invoke-WebRequest -Uri $metricsUrl -TimeoutSec 4).Content
  $paths = (Invoke-RestMethod -Uri $pathsUrl -TimeoutSec 4).items
  $process = $null
  if ($Mode -eq "standalone") { $process = Get-Process mediamtx -ErrorAction SilentlyContinue | Select-Object -First 1 }
  [pscustomobject]@{
    time = Get-Date
    readySources = @($paths | Where-Object ready).Count
    readers = Read-MetricSum $metrics "paths_readers"
    hlsSessions = Read-MetricSum $metrics "hls_sessions"
    inboundBytes = Read-MetricSum $metrics "paths_inbound_bytes"
    outboundBytes = Read-MetricSum $metrics "paths_outbound_bytes"
    inputFrameErrors = Read-MetricSum $metrics "paths_inbound_frames_in_error"
    cpuSeconds = if ($process) { $process.CPU } else { $null }
    memoryBytes = if ($process) { $process.WorkingSet64 } else { $null }
  }
}

if ($Mode -eq "compose") {
  $containerId = docker compose ps -q mediamtx
  if (-not $containerId) { throw "MediaMTX Compose container is not running." }
}
$before = Read-Snapshot
Write-Output "Sampling MediaMTX for $DurationSeconds seconds; this does not launch clients."
Start-Sleep -Seconds $DurationSeconds
$after = Read-Snapshot
$elapsed = ($after.time - $before.time).TotalSeconds
$cpuPercent = $null
$memory = $null
if ($Mode -eq "standalone" -and $null -ne $before.cpuSeconds -and $null -ne $after.cpuSeconds) {
  $cpuPercent = [math]::Round((($after.cpuSeconds - $before.cpuSeconds) / $elapsed / [Environment]::ProcessorCount) * 100, 2)
  $memory = [math]::Round($after.memoryBytes / 1MB, 1)
} elseif ($Mode -eq "compose") {
  $stats = docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}}" $containerId
  $cpuPercent = ($stats -split ",")[0]
  $memory = ($stats -split ",")[1]
}

[pscustomobject]@{
  sampleSeconds = [math]::Round($elapsed, 1)
  readySourcesStart = $before.readySources
  readySourcesEnd = $after.readySources
  activeReadersEnd = $after.readers
  activeHlsSessionsEnd = $after.hlsSessions
  inboundBytesPerSecond = [math]::Round(($after.inboundBytes - $before.inboundBytes) / $elapsed, 1)
  outboundBytesPerSecond = [math]::Round(($after.outboundBytes - $before.outboundBytes) / $elapsed, 1)
  inputFrameErrorsDelta = $after.inputFrameErrors - $before.inputFrameErrors
  mediaServerCpu = $cpuPercent
  mediaServerMemory = $memory
  clientCountNote = "Readers are MediaMTX readers, not user accounts; no clients are started by this script."
} | ConvertTo-Json -Depth 3
