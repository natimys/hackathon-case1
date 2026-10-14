#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI not found. Install Docker Engine and the Compose plugin." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is unavailable." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env, set unique development secrets, and retry." >&2
  exit 1
fi

environment="${ENVIRONMENT:-}"
if [[ -z "$environment" ]]; then
  environment="$(sed -nE 's/^\s*ENVIRONMENT\s*=\s*([^#[:space:]]+).*$/\1/p' .env | head -n 1 | tr -d "\"'")"
fi
environment="${environment:-development}"
environment="${environment,,}"
if [[ "$environment" != development && "$environment" != test ]]; then
  echo "Refusing to start the development launcher with ENVIRONMENT=$environment." >&2
  exit 1
fi

case "${1:-}" in
  "") docker compose up -d --build ;;
  --no-build) docker compose up -d ;;
  *) echo "Usage: $0 [--no-build]" >&2; exit 2 ;;
esac

deadline=$((SECONDS + 120))
required_services=(db backend frontend)
while (( SECONDS < deadline )); do
  ready=true
  for service in "${required_services[@]}"; do
    container_id="$(docker compose ps -q "$service")"
    if [[ -z "$container_id" ]]; then
      ready=false
      break
    fi
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    if [[ "$state" != healthy ]]; then
      ready=false
      break
    fi
  done
  if [[ "$ready" == true ]]; then break; fi
  sleep 2
done

if [[ "${ready:-false}" != true ]]; then
  docker compose ps
  echo "Services did not become healthy within two minutes. Existing volumes were left untouched." >&2
  exit 1
fi

media_ready=false
for _ in {1..30}; do
  if curl --fail --silent --max-time 2 http://127.0.0.1:9997/v3/paths/list >/dev/null \
    && curl --fail --silent --max-time 2 http://127.0.0.1:9998/metrics >/dev/null; then
    media_ready=true
    break
  fi
  sleep 1
done
if [[ "$media_ready" != true ]]; then
  echo "MediaMTX Control API is unavailable. Review: docker compose logs mediamtx" >&2
  exit 1
fi

docker compose ps
echo "Development services are ready. Demo seed is a separate manual command; see README.md."
