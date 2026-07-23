"""Vercel Python serverless entry point.

Requires DATABASE_URL (PostgreSQL / Neon) for persistent storage across cold starts.
"""
import os
import sys

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# Require DATABASE_URL in Vercel production to enforce Neon/PostgreSQL cloud persistence
if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL"):
    raise RuntimeError(
        "DATABASE_URL environment variable is missing in Vercel production! "
        "Please add your Neon PostgreSQL connection string (DATABASE_URL) in your Vercel Project Settings."
    )

if os.environ.get("VERCEL") and not os.environ.get("UPLOAD_DIR"):
    os.environ["UPLOAD_DIR"] = "/tmp/uploads"

# Mark as Vercel production
os.environ.setdefault("APP_ENV", "production")

from app.main import app as app  # noqa: E402
