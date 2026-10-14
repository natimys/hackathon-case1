from datetime import datetime, timedelta, timezone

import jwt


def issue_media_token(
    *, secret: str, issuer: str, audience: str, user_id: int, path: str, ttl: int = 120
) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": issuer,
            "aud": audience,
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(seconds=ttl),
            "mediamtx_permissions": [{"action": "read", "path": path}],
        },
        secret,
        algorithm="HS256",
    )


def media_token_allows(
    *, token: str, secret: str, issuer: str, audience: str, action: str, path: str
) -> bool:
    if action != "read":
        return False
    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=audience,
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "mediamtx_permissions"]},
        )
    except jwt.PyJWTError:
        return False
    permissions = claims.get("mediamtx_permissions", [])
    return any(
        item.get("action") == "read" and item.get("path") == path
        for item in permissions
        if isinstance(item, dict)
    )
