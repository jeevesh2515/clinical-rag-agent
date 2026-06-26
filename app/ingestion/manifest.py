import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path


DEFAULT_MANIFEST_DIR = Path("data/source_documents/manifests")


@dataclass
class ManifestEntry:
    source_id: str
    title: str
    url: str
    organization: str = ""
    publication_year: int | None = None
    version: str | None = None
    page_count: int = 0
    chunk_count: int = 0
    content_hash: str = ""
    ingested_at: str = ""
    status: str = "success"
    error: str | None = None


@dataclass
class IngestionManifest:
    manifest_id: str
    ingested_at: str
    entries: list[ManifestEntry]
    total_chunks: int
    total_documents: int
    status: str = "success"


def build_manifest_id() -> str:
    return datetime.now(timezone.utc).strftime("ingest-%Y%m%dT%H%M%S")


def save_manifest(
    manifest: IngestionManifest,
    manifest_dir: Path = DEFAULT_MANIFEST_DIR,
) -> Path:
    manifest_dir.mkdir(parents=True, exist_ok=True)
    path = manifest_dir / f"{manifest.manifest_id}.json"
    path.write_text(json.dumps(asdict(manifest, dict_factory=_compact_dict), indent=2))
    return path


def _compact_dict(items):
    return {k: v for k, v in items if v is not None and v != ""}


def load_manifest(
    manifest_id: str,
    manifest_dir: Path = DEFAULT_MANIFEST_DIR,
) -> IngestionManifest | None:
    path = manifest_dir / f"{manifest_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text())
    return IngestionManifest(
        manifest_id=data["manifest_id"],
        ingested_at=data["ingested_at"],
        entries=[ManifestEntry(**e) for e in data["entries"]],
        total_chunks=data["total_chunks"],
        total_documents=data["total_documents"],
        status=data.get("status", "success"),
    )


def list_manifests(manifest_dir: Path = DEFAULT_MANIFEST_DIR) -> list[str]:
    if not manifest_dir.exists():
        return []
    return sorted(
        (path.stem for path in manifest_dir.glob("ingest-*.json")),
        reverse=True,
    )
