"""Vercel Python serverless entry point.

Ensures the database is properly configured for the ephemeral /tmp filesystem.
On cold starts the SQLite file is fresh, so tables are re-created and previous
data is lost. For persistent storage across cold starts, set DATABASE_URL to a
Postgres connection string in your Vercel project environment variables.
"""
import os
import sys

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# On Vercel serverless, /tmp is writable but ephemeral — data is lost on cold start.
# For production persistence, set DATABASE_URL to a Postgres URL in Vercel env vars.
if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/clinical_demo.db"

if os.environ.get("VERCEL") and not os.environ.get("UPLOAD_DIR"):
    os.environ["UPLOAD_DIR"] = "/tmp/uploads"

# Mark as Vercel so the app can adjust behaviour accordingly
os.environ.setdefault("APP_ENV", "production")

from app.main import app as app
