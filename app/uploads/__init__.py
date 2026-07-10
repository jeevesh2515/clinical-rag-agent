"""Uploads module: routes + helpers for user-uploaded files (PDF/image).

Importing this package registers the routes via :func:`register_routes`.
"""

from app.uploads.routes import router

__all__ = ["router"]