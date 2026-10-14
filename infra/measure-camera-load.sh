#!/usr/bin/env bash
set -Eeuo pipefail

duration=30
while (($#)); do
  case "$1" in
    --duration) (($# >= 2)) || { echo "--duration requires seconds" >&2; exit 2; }; duration="$2"; shift 2 ;;
    -h|--help) echo "Usage: $0 [--duration SECONDS]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
[[ "$duration" =~ ^[0-9]+$ ]] && ((duration >= 5 && duration <= 3600)) || {
  echo "Duration must be an integer from 5 to 3600 seconds." >&2; exit 2;
}
command -v curl >/dev/null && command -v python3 >/dev/null && command -v docker >/dev/null || {
  echo "This command requires curl, python3, and Docker Compose." >&2; exit 1;
}
container_id="$(docker compose ps -q mediamtx)"
[[ -n "$container_id" ]] || { echo "MediaMTX Compose container is not running." >&2; exit 1; }

snapshot() {
  local metrics paths
  metrics="$(curl --fail --silent --show-error --max-time 4 http://127.0.0.1:9998/metrics)"
  paths="$(curl --fail --silent --show-error --max-time 4 http://127.0.0.1:9997/v3/paths/list)"
  python3 -c '
import json, re, sys
metrics, paths = sys.argv[1], json.loads(sys.argv[2])
def total(name):
    pattern = rf"^{re.escape(name)}(?:\{{[^}}]*\}})?\s+([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*$"
    return sum(float(m.group(1)) for line in metrics.splitlines() if (m := re.match(pattern, line)))
print(json.dumps({"time": __import__("time").time(),
    "readySources": sum(1 for path in paths.get("items", []) if path.get("ready")),
    "readers": total("paths_readers"), "hlsSessions": total("hls_sessions"),
    "inboundBytes": total("paths_inbound_bytes"), "outboundBytes": total("paths_outbound_bytes"),
    "inputFrameErrors": total("paths_inbound_frames_in_error")}))
' "$metrics" "$paths"
}

echo "Sampling MediaMTX for $duration seconds; this does not launch clients." >&2
before="$(snapshot)"
sleep "$duration"
after="$(snapshot)"
stats="$(docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}}' "$container_id")"
python3 -c '
import json, sys
a, b = json.loads(sys.argv[1]), json.loads(sys.argv[2]); elapsed = b["time"] - a["time"]
cpu, memory = sys.argv[3].split(",", 1)
print(json.dumps({"sampleSeconds": round(elapsed, 1),
  "readySourcesStart": a["readySources"], "readySourcesEnd": b["readySources"],
  "activeReadersEnd": b["readers"], "activeHlsSessionsEnd": b["hlsSessions"],
  "inboundBytesPerSecond": round((b["inboundBytes"]-a["inboundBytes"])/elapsed, 1),
  "outboundBytesPerSecond": round((b["outboundBytes"]-a["outboundBytes"])/elapsed, 1),
  "inputFrameErrorsDelta": b["inputFrameErrors"]-a["inputFrameErrors"],
  "mediaServerCpu": cpu, "mediaServerMemory": memory,
  "clientCountNote": "Readers are MediaMTX readers, not user accounts; this script starts no clients."}, ensure_ascii=False, indent=2))
' "$before" "$after" "$stats"
