import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

_DEFAULT_KEY = "change-me-in-production-use-a-strong-random-key"


def _resolve_secret_key() -> str:
    """Single source of truth: Settings reads `.env`; fall back to process env."""
    try:
        from app.core.config import get_settings

        configured = get_settings().jwt_secret_key or os.getenv("JWT_SECRET_KEY")
    except Exception:
        configured = os.getenv("JWT_SECRET_KEY")
    return configured or _DEFAULT_KEY


def _resolve_app_env() -> str:
    try:
        from app.core.config import get_settings

        return str(get_settings().app_env or "local").strip().lower()
    except Exception:
        return os.getenv("APP_ENV", "local").strip().lower()


SECRET_KEY = _resolve_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

if SECRET_KEY == _DEFAULT_KEY and _resolve_app_env() != "local":
    raise ValueError(
        "JWT_SECRET_KEY is set to the insecure default in a non-local environment. "
        "Generate a strong key with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\" "
        "and set it as the JWT_SECRET_KEY environment variable."
    )

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Malformed hash or over-long password: never authenticate, never 500.
        return False

def get_password_hash(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        # ponytail: bcrypt hard-caps at 72 bytes; reject instead of 500.
        raise ValueError("Password must be at most 72 characters.")
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
