#!/usr/bin/env python3
"""Day 31 (post-review) — Mint a long-lived JWT for k6 load testing.

Required by `scripts/setup_gh_secrets.sh` so the GH Actions `STAGING_TOKEN`
secret is a JWT the app will actually accept (instead of the raw
``JWT_SECRET_KEY`` seed, which the auth middleware would reject).

Reads ``JWT_SECRET_KEY`` from the environment (must match the value deployed
in the cluster), mints a token with a 24h TTL, prints it to stdout.

Usage:
    JWT_SECRET_KEY="$(kubectl get secret ... -o jsonpath='{.data.JWT_SECRET_KEY}' | base64 -d)" \\
        python3 scripts/mint_load_test_token.py
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

from jose import jwt

ALGORITHM = "HS256"
SUBJECT = "load-test@staging.local"
USER_ID = "load-test"
TTL_HOURS = 24


def main() -> int:
    secret = os.environ.get("JWT_SECRET_KEY")
    if not secret:
        print(
            "ERROR: JWT_SECRET_KEY env var is required (must match the cluster's secret).",
            file=sys.stderr,
        )
        return 2

    now = datetime.now(timezone.utc)
    payload = {
        "sub": SUBJECT,
        "uid": USER_ID,
        "iat": now,
        "exp": now + timedelta(hours=TTL_HOURS),
    }
    token = jwt.encode(payload, secret, algorithm=ALGORITHM)
    print(token)
    return 0


if __name__ == "__main__":
    sys.exit(main())