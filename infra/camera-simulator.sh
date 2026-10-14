#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 {single|quad|load50|status|stop} [--host ADDRESS] [--ffmpeg PATH]"
}

profile="${1:-}"
if [[ -z "$profile" ]]; then usage >&2; exit 2; fi
shift
host_address="127.0.0.1"
ffmpeg_bin="ffmpeg"
while (($#)); do
  case "$1" in
    --host) (($# >= 2)) || { usage >&2; exit 2; }; host_address="$2"; shift 2 ;;
    --ffmpeg) (($# >= 2)) || { usage >&2; exit 2; }; ffmpeg_bin="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done
case "$profile" in single|quad|load50|status|stop) ;; *) usage >&2; exit 2 ;; esac

state_dir="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/yakutsk-home-camera-simulator-${UID}"
mkdir -p "$state_dir"
manifest="$state_dir/processes.tsv"
exec 9>"$state_dir/lock"
flock -n 9 || { echo "Another camera simulator command is running." >&2; exit 1; }

is_owned_process() {
  local pid="$1" url="$2" cmdline
  [[ -r "/proc/$pid/cmdline" ]] || return 1
  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline")"
  [[ "$cmdline" == *ffmpeg* && "$cmdline" == *"$url"* ]]
}

active_lines() {
  [[ -f "$manifest" ]] || return 0
  while IFS=$'\t' read -r pid url; do
    [[ "$pid" =~ ^[0-9]+$ && -n "$url" ]] || continue
    if is_owned_process "$pid" "$url"; then printf '%s\t%s\n' "$pid" "$url"; fi
  done < "$manifest"
}

if [[ "$profile" == status || "$profile" == stop ]]; then
  mapfile -t active < <(active_lines)
  if [[ "$profile" == stop ]]; then
    for line in "${active[@]}"; do
      IFS=$'\t' read -r pid url <<< "$line"
      if is_owned_process "$pid" "$url"; then kill "$pid"; fi
    done
    rm -f -- "$manifest"
    echo "Stopped ${#active[@]} simulator-owned RTSP source(s)."
  else
    echo "Active simulator-owned RTSP sources: ${#active[@]}"
    printf '%s\n' "${active[@]}"
  fi
  exit 0
fi

command -v "$ffmpeg_bin" >/dev/null 2>&1 || {
  echo "FFmpeg was not found. Install FFmpeg or pass --ffmpeg /path/to/ffmpeg." >&2
  exit 1
}
command -v nohup >/dev/null 2>&1 || { echo "nohup was not found." >&2; exit 1; }
if [[ "$profile" == load50 ]]; then
  echo "Warning: load50 starts 50 CPU-encoded FFmpeg publishers and can heavily load the test host." >&2
fi
mapfile -t active < <(active_lines)
if ((${#active[@]})); then
  echo "Simulator sources are already running. Stop them with $0 stop before starting another profile." >&2
  exit 1
fi

case "$profile" in single) count=1 ;; quad) count=4 ;; load50) count=50 ;; esac
tmp_manifest="$manifest.tmp.$$"
: > "$tmp_manifest"
started=()
started_urls=()
cleanup() {
  for i in "${!started[@]}"; do
    pid="${started[$i]}"
    url="${started_urls[$i]}"
    if is_owned_process "$pid" "$url"; then kill "$pid" 2>/dev/null || true; fi
  done
  rm -f -- "$tmp_manifest"
}
trap cleanup ERR
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

for ((i=1; i<=count; i++)); do
  printf -v path 'demo/camera-%03d' "$i"
  url="rtsp://${host_address}:8554/${path}"
  nohup "$ffmpeg_bin" -hide_banner -loglevel error -nostdin -re \
    -f lavfi -i 'testsrc=size=320x180:rate=8' -an \
    -c:v libx264 -preset ultrafast -tune zerolatency -threads 1 \
    -g 8 -keyint_min 8 -sc_threshold 0 -pix_fmt yuv420p \
    -f rtsp -rtsp_transport tcp "$url" \
    >"$state_dir/camera-$(printf '%03d' "$i").log" 2>&1 </dev/null &
  pid=$!
  started+=("$pid")
  started_urls+=("$url")
  printf '%s\t%s\n' "$pid" "$url" >> "$tmp_manifest"
done
sleep 2
for i in "${!started[@]}"; do
  IFS=$'\t' read -r pid url < <(sed -n "$((i + 1))p" "$tmp_manifest")
  if ! is_owned_process "$pid" "$url"; then
    echo "FFmpeg publisher failed to start for $url. See $state_dir logs." >&2
    false
  fi
done
mv -f -- "$tmp_manifest" "$manifest"
trap - ERR INT TERM
echo "Started $count RTSP source(s) for profile '$profile'. Check MediaMTX and Camera API status for readiness."
