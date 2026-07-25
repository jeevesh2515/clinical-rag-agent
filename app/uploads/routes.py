"""File upload routes — prescriptions, doctor notes, lab images, etc.

Users upload PDFs (text extracted with ``pypdf``) or images (stored as-is,
plus the user's free-text note is always indexed). Files are written through
the storage backend selected via ``STORAGE_BACKEND`` (Day 28):

  - ``local`` (default) — files persist under ``data/uploads/<user_id>/...``
  - ``s3``               — files persist in the configured ``S3_BUCKET`` with
                            key prefix ``uploads/<user_id>/...``

The ``storage_path`` column on the ``uploads`` table stores either the
local relative path or the S3 key, depending on the backend. Retrieval
goes through the same backend so callers don't have to branch on backend.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.routes import get_current_active_user
from app.db import Upload as OrmUpload
from app.db import User as OrmUser
from app.db import get_db, utcnow
from app.personalization import personal_index

router = APIRouter()

# Allowed MIME types per category.
ALLOWED_PDF_MIMES = {"application/pdf"}
ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
ALLOWED_MIMES = ALLOWED_PDF_MIMES | ALLOWED_IMAGE_MIMES

# 10 MB per upload — generous for prescriptions, bounded for safety.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

UploadCategory = Literal["prescription", "doctor_note", "lab_report", "image", "other"]
UploadKind = Literal["pdf", "image"]

UPLOAD_ROOT = Path(os.environ.get("UPLOAD_DIR", "data/uploads"))

# Day 28 — Optional S3-compatible storage backend. Selected via env var
# STORAGE_BACKEND=s3 (with S3_BUCKET set) or STORAGE_BACKEND=local (default).
# Backends share the same put/get/delete/presigned_url interface.
# Module-level snapshot of the active backend choice so route helpers
# (e.g. _persist_file) can branch on it without re-reading settings.
_storage_backend: object | None = None
_storage_choice: str = "local"
try:
    from app.storage.factory import build_storage
    from app.core.config import get_settings as _get_settings

    _settings = _get_settings()
    _storage_choice = _settings.storage_backend
    _storage_backend = build_storage(
        backend=_storage_choice,
        s3_bucket=_settings.s3_bucket,
        s3_region=_settings.s3_region,
        local_root=_settings.uploads_local_root,
    )
    import logging as _log_mod
    _log_mod.getLogger(__name__).info(
        "uploads_storage_initialised backend=%s", _storage_choice,
    )
except Exception as _exc:  # noqa: BLE001 — fall back to local FS
    import logging as _log_mod
    _log_mod.getLogger(__name__).warning("uploads_storage_init_failed err=%s", _exc)
    _storage_backend = None
    _storage_choice = "local"


def _persist_file(*, user_id: str, upload_id: str, filename: str, body: bytes, content_type: str) -> tuple[str, str]:
    """Write the file through the storage backend and return (storage_path, location_url).

    - When the S3 backend is configured, ``storage_path`` is the S3 key.
    - When the local backend is configured (or the factory fell back), the
      file is written under ``data/uploads/<user_id>/<upload_id>/<filename>``
      and ``storage_path`` is the path relative to ``UPLOAD_ROOT``.

    ``location_url`` is the backend-specific URL returned by ``put()`` (S3 URI
    or absolute local path). It is logged for debugging but not exposed.
    """
    # Pull the active storage backend choice from settings (not a walrus
    # assignment to None — that would always evaluate to "local").
    use_s3 = _storage_backend is not None and _storage_choice == "s3"
    if use_s3:
        key = f"uploads/{user_id}/{upload_id}/{filename}"
        url = _storage_backend.put(key, body, content_type=content_type)
        return key, url
    # Local backend (default) — write under UPLOAD_ROOT.
    user_dir = UPLOAD_ROOT / user_id / upload_id
    user_dir.mkdir(parents=True, exist_ok=True)
    target = user_dir / filename
    target.write_bytes(body)
    rel = str(target.relative_to(UPLOAD_ROOT))
    return rel, str(target)


def _delete_stored(storage_path: str) -> None:
    """Remove the file via the storage backend, or locally as a fallback."""
    if _storage_backend is not None and storage_path.startswith("uploads/"):
        try:
            _storage_backend.delete(storage_path)
            return
        except Exception as exc:  # noqa: BLE001
            import logging as _log_mod
            _log_mod.getLogger(__name__).warning("s3_delete_failed key=%s err=%s", storage_path, exc)
    # Local fallback — storage_path is relative to UPLOAD_ROOT.
    target = UPLOAD_ROOT / storage_path
    if target.exists():
        target.unlink()
    # Best-effort: also remove the empty parent directory tree.
    try:
        target.parent.rmdir()
    except OSError:
        pass


def _read_stored(storage_path: str) -> bytes | None:
    """Read a previously-stored file through the backend (or locally)."""
    if _storage_backend is not None and storage_path.startswith("uploads/"):
        try:
            return _storage_backend.get(storage_path)
        except Exception as exc:  # noqa: BLE001
            import logging as _log_mod
            _log_mod.getLogger(__name__).warning("s3_get_failed key=%s err=%s", storage_path, exc)
            return None
    target = UPLOAD_ROOT / storage_path
    if target.exists():
        return target.read_bytes()
    return None


def _detect_kind(content_type: str) -> UploadKind:
    if content_type in ALLOWED_PDF_MIMES:
        return "pdf"
    if content_type in ALLOWED_IMAGE_MIMES:
        return "image"
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"Unsupported file type: {content_type}",
    )


def _safe_filename(name: str) -> str:
    name = Path(name).name  # strip any directory parts
    # Replace anything that isn't letter / digit / dot / underscore / dash.
    cleaned = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)
    return cleaned[:200] or "upload"


def _extract_pdf_text(body: bytes) -> str:
    try:
        from pypdf import PdfReader  # local import to avoid mandatory dep at startup
        from io import BytesIO
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"PDF support missing: {exc}") from exc
    try:
        reader = PdfReader(BytesIO(body))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}") from exc
    out: list[str] = []
    for page in reader.pages:
        try:
            out.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n\n".join(out).strip()


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload(
    file: UploadFile = File(...),
    category: UploadCategory = Form("other"),
    user_note: str | None = Form(None),
    current_user: OrmUser = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if not file.content_type or file.content_type not in ALLOWED_MIMES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )
    kind = _detect_kind(file.content_type)

    # Materialise the upload in memory (bounded by MAX_UPLOAD_BYTES) so we
    # can route through the storage backend. For local FS this still writes
    # a real file; for S3 the bytes go directly to boto3.
    upload_id = str(uuid4())
    original_name = _safe_filename(file.filename or "upload")

    bytes_buf = bytearray()
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        bytes_buf.extend(chunk)
        if len(bytes_buf) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Upload exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
            )
    body = bytes(bytes_buf)
    bytes_written = len(body)

    extracted_text: str | None = None
    if kind == "pdf":
        extracted_text = _extract_pdf_text(body) or None

    storage_path, _location_url = _persist_file(
        user_id=current_user.id,
        upload_id=upload_id,
        filename=original_name,
        body=body,
        content_type=file.content_type,
    )

    display_title = original_name.rsplit(".", 1)[0].replace("_", " ").strip() or original_name
    if user_note:
        display_title = f"{display_title} — {user_note[:60]}"

    upload_row = OrmUpload(
        id=upload_id,
        user_id=current_user.id,
        category=category,
        kind=kind,
        original_filename=original_name,
        storage_path=storage_path,
        mime_type=file.content_type,
        size_bytes=bytes_written,
        user_note=user_note,
        extracted_text=extracted_text,
        display_title=display_title[:255],
        chunk_count=0,
        created_at=utcnow(),
    )
    db.add(upload_row)
    db.commit()
    db.refresh(upload_row)

    # Index for retrieval.
    chunk_count = personal_index.add_upload(db, upload_row)
    upload_row.chunk_count = chunk_count
    db.commit()
    db.refresh(upload_row)

    return upload_row.to_dict()


@router.get("/uploads")
async def list_uploads(
    current_user: OrmUser = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(OrmUpload)
        .filter(OrmUpload.user_id == current_user.id)
        .order_by(OrmUpload.created_at.desc())
        .all()
    )
    return {"uploads": [row.to_dict() for row in rows], "total": len(rows)}


@router.get("/uploads/{upload_id}")
async def get_upload(
    upload_id: str,
    current_user: OrmUser = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(OrmUpload)
        .filter(OrmUpload.id == upload_id, OrmUpload.user_id == current_user.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")
    payload = row.to_dict()
    if row.extracted_text:
        payload["extracted_text"] = row.extracted_text
    return payload


@router.delete("/uploads/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_upload(
    upload_id: str,
    current_user: OrmUser = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(OrmUpload)
        .filter(OrmUpload.id == upload_id, OrmUpload.user_id == current_user.id)
        .one_or_none()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Remove from index first so a query mid-delete can't see a ghost chunk.
    personal_index.remove_upload(current_user.id, upload_id)
    db.delete(row)
    db.commit()

    _delete_stored(row.storage_path)
    return