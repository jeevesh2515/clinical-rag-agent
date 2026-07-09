"""Vercel Python serverless entry point."""
import os
import sys

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

if os.environ.get("VERCEL") and not os.environ.get("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "sqlite:////tmp/clinical_demo.db"

if os.environ.get("VERCEL") and not os.environ.get("UPLOAD_DIR"):
    os.environ["UPLOAD_DIR"] = "/tmp/uploads"

from app.main import app as app
