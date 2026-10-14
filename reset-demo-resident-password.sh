#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

read -rsp 'New password for demo.resident@example.com (12+ chars): ' password
printf '\n'
read -rsp 'Confirm new password: ' confirmation
printf '\n'
if ((${#password} < 12)); then
  echo "Password must contain at least 12 characters." >&2
  exit 1
fi
if [[ "$password" != "$confirmation" ]]; then
  echo "Passwords did not match." >&2
  exit 1
fi

python_code="$(cat <<'PY'
import asyncio
import sys
import httpx
from sqlalchemy import select
from core.security import hash_password
from core.settings import get_settings
from database.engine import create_engine_and_sessionmaker
from modules.users.models import User

EMAIL = "demo.resident@example.com"

async def main():
    password = sys.stdin.readline().rstrip("\r\n")
    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters; no database changes made.")
    settings = get_settings()
    if settings.ENVIRONMENT != "development":
        raise SystemExit("Refusing to change password outside development.")
    new_hash = hash_password(password)
    engine, session_factory = create_engine_and_sessionmaker(settings.DATABASE_URL)
    old_hash = None
    try:
        async with session_factory() as db:
            users = (await db.scalars(select(User).where(User.email == EMAIL))).all()
            if len(users) != 1 or not users[0].is_active:
                raise SystemExit("Expected exactly one active existing demo user; no changes made.")
            user = users[0]
            old_hash = user.password
            user.password = new_hash
            await db.commit()
        try:
            async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                response = await client.post(
                    "http://127.0.0.1:8000/auth/mobile/login",
                    json={"email": EMAIL, "password": password},
                )
            status = response.status_code
            body = response.json() if status == 200 else {}
            ok = bool(body.get("access_token") and body.get("refresh_token"))
        except Exception:
            status = 0
            ok = False
        if not ok:
            async with session_factory() as db:
                user = await db.scalar(select(User).where(User.email == EMAIL))
                if user is not None and user.password == new_hash:
                    user.password = old_hash
                    await db.commit()
                    print("password_reset=rolled_back")
                else:
                    print("password_reset=rollback_skipped_due_to_concurrent_change")
            print("mobile_login_http_status=" + str(status))
            raise SystemExit("Mobile login verification failed; response body and credentials were not logged.")
        print("password_reset=committed_for_existing_user_only")
        print("mobile_login_http_status=" + str(status))
        print("mobile_token_pair_valid=True")
    finally:
        await engine.dispose()

asyncio.run(main())
PY
)"

set +e
printf '%s\n' "$password" | docker compose exec -T backend python -c "$python_code"
status=$?
set -e
unset password confirmation python_code
exit "$status"
