import hashlib
import ipaddress
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
from pypdf import PdfReader
from pypdf.errors import PdfReadError, PdfStreamError

from app.ingestion.chunker import TextChunk, chunk_page
from app.ingestion.manifest import ManifestEntry
from app.models import IngestSource

DEFAULT_RAW_DOCUMENT_DIR = Path("data/source_documents/raw")
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024


@dataclass
class IngestResult:
    chunks: list[TextChunk] = field(default_factory=list)
    entries: list[ManifestEntry] = field(default_factory=list)


def pdf_path_for(
    source: IngestSource, data_dir: Path = DEFAULT_RAW_DOCUMENT_DIR
) -> Path:
    digest = hashlib.sha1(source.url.encode("utf-8")).hexdigest()[:10]
    return data_dir / f"{source.source_id}-{digest}.pdf"


def _validate_download_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in ("https",):
        raise ValueError(
            f"Download URL must use HTTPS scheme: {parsed.scheme}://"
        )
    hostname = parsed.hostname or ""
    if hostname in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        raise ValueError("Download URL must not point to localhost or loopback address")
    try:
        addr = ipaddress.ip_address(hostname)
        if addr.is_private or addr.is_loopback or addr.is_link_local:
            raise ValueError(
                "Download URL must not point to a private or reserved IP address"
            )
    except ValueError:
        pass


def download_pdf(
    source: IngestSource, data_dir: Path = DEFAULT_RAW_DOCUMENT_DIR
) -> Path:
    _validate_download_url(source.url)
    data_dir.mkdir(parents=True, exist_ok=True)
    path = pdf_path_for(source, data_dir)
    if path.exists() and path.stat().st_size > 0 and _looks_like_pdf(path):
        return path
    if path.exists():
        path.unlink()
    with httpx.stream("GET", source.url, follow_redirects=True, timeout=60) as response:
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_DOWNLOAD_BYTES:
            raise ValueError(
                f"Source {source.source_id} PDF exceeds maximum download size "
                f"({int(content_length)} > {MAX_DOWNLOAD_BYTES} bytes)"
            )
        if "pdf" not in content_type.lower() and not source.url.lower().endswith(
            ".pdf"
        ):
            raise ValueError(
                f"Source {source.source_id} did not return PDF content. "
                f"content-type={content_type!r}"
            )
        downloaded = 0
        with path.open("wb") as handle:
            for chunk in response.iter_bytes():
                downloaded += len(chunk)
                if downloaded > MAX_DOWNLOAD_BYTES:
                    path.unlink(missing_ok=True)
                    raise ValueError(
                        f"Source {source.source_id} download exceeded {MAX_DOWNLOAD_BYTES} bytes"
                    )
                handle.write(chunk)
    if not _looks_like_pdf(path):
        path.unlink(missing_ok=True)
        raise ValueError(
            f"Source {source.source_id} downloaded content that is not a PDF"
        )
    return path


def extract_pdf_chunks(source: IngestSource, pdf_path: Path) -> list[TextChunk]:
    try:
        reader = PdfReader(str(pdf_path))
    except (PdfReadError, PdfStreamError) as exc:
        raise ValueError(
            f"Unable to parse PDF for source {source.source_id}"
        ) from exc
    chunks: list[TextChunk] = []
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""
        chunks.extend(
            chunk_page(
                source_id=source.source_id,
                title=source.title,
                source_url=source.url,
                page=page_number,
                text=page_text,
                organization=source.organization,
                publication_year=source.publication_year,
            )
        )
    return chunks


def ingest_sources(sources: list[IngestSource]) -> IngestResult:
    all_chunks: list[TextChunk] = []
    entries: list[ManifestEntry] = []
    now = datetime.now(timezone.utc).isoformat()

    for source in sources:
        path = download_pdf(source)
        chunks = extract_pdf_chunks(source, path)
        file_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        page_count = len({c.page for c in chunks})
        all_chunks.extend(chunks)
        entries.append(
            ManifestEntry(
                source_id=source.source_id,
                title=source.title,
                url=source.url,
                organization=source.organization,
                publication_year=source.publication_year,
                version=source.version,
                page_count=page_count,
                chunk_count=len(chunks),
                content_hash=file_hash,
                ingested_at=now,
            )
        )

    return IngestResult(chunks=all_chunks, entries=entries)


def _looks_like_pdf(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            return handle.read(5) == b"%PDF-"
    except FileNotFoundError:
        return False
