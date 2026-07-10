"""File upload routes — prescriptions, doctor notes, lab images, etc.

Users upload PDFs (text extracted with ``pypdf``) or images (stored as-is,
plus the user's free-text note is always indexed). Files live on disk under
``data/uploads/<user_id>/<upload_id>/`` and metadata lives in SQLite.
"""

from __future__ import annotations

import os
import shutil
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


def _extract_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader  # local import to avoid mandatory dep at startup
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"PDF support missing: {exc}") from exc
    try:
        reader = PdfReader(str(path))
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

    # Materialise the upload to disk first so we can enforce size limits and
    # extract PDF text without keeping the body in memory twice.
    upload_id = str(uuid4())
    user_dir = UPLOAD_ROOT / current_user.id / upload_id
    user_dir.mkdir(parents=True, exist_ok=True)

    original_name = _safe_filename(file.filename or "upload")
    storage_path = user_dir / original_name
    bytes_written = 0
    with storage_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            bytes_written += len(chunk)
            if bytes_written > MAX_UPLOAD_BYTES:
                out.close()
                shutil.rmtree(user_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Upload exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit",
                )
            out.write(chunk)

    extracted_text: str | None = None
    if kind == "pdf":
        extracted_text = _extract_pdf_text(storage_path) or None

    display_title = original_name.rsplit(".", 1)[0].replace("_", " ").strip() or original_name
    if user_note:
        display_title = f"{display_title} — {user_note[:60]}"

    upload_row = OrmUpload(
        id=upload_id,
        user_id=current_user.id,
        category=category,
        kind=kind,
        original_filename=original_name,
        storage_path=str(storage_path.relative_to(UPLOAD_ROOT)),
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

    user_dir = UPLOAD_ROOT / current_user.id / upload_id
    shutil.rmtree(user_dir, ignore_errors=True)
    return