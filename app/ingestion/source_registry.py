from urllib.parse import urlparse

from app.ingestion.manifest import DEFAULT_MANIFEST_DIR, list_manifests, load_manifest
from app.ingestion.sources import DEFAULT_SOURCES
from app.models import SourceMetadata
def _domain_from_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or ""


def _latest_manifest_entries(
    manifest_dir=DEFAULT_MANIFEST_DIR,
) -> dict[str, dict]:
    """Return the most recent manifest entry per source_id."""
    latest: dict[str, dict] = {}
    for manifest_id in list_manifests(manifest_dir):
        manifest = load_manifest(manifest_id, manifest_dir=manifest_dir)
        if manifest is None:
            continue
        for entry in manifest.entries:
            existing = latest.get(entry.source_id)
            if existing is None or entry.ingested_at >= existing["ingested_at"]:
                latest[entry.source_id] = {
                    "ingested_at": entry.ingested_at,
                    "chunk_count": entry.chunk_count,
                    "page_count": entry.page_count,
                    "content_hash": entry.content_hash,
                    "version": entry.version,
                    "manifest_id": manifest.manifest_id,
                    "status": entry.status,
                }
    return latest


def build_source_registry(store: object) -> list[SourceMetadata]:
    """Merge canonical default sources, live index state, and ingestion manifests."""
    indexed_docs = {doc["source_id"]: doc for doc in store.list_documents()}
    manifest_by_source = _latest_manifest_entries()
    catalog = {source.source_id: source for source in DEFAULT_SOURCES}

    source_ids = sorted(set(catalog) | set(indexed_docs) | set(manifest_by_source))
    registry: list[SourceMetadata] = []

    for source_id in source_ids:
        catalog_entry = catalog.get(source_id)
        indexed = indexed_docs.get(source_id)
        manifest_entry = manifest_by_source.get(source_id)

        title = catalog_entry.title if catalog_entry else indexed.get("title", source_id) if indexed else source_id
        url = catalog_entry.url if catalog_entry else indexed.get("source_url", "") if indexed else ""
        organization = catalog_entry.organization if catalog_entry else ""
        publication_year = catalog_entry.publication_year if catalog_entry else None
        version = catalog_entry.version if catalog_entry else None
        if manifest_entry and manifest_entry.get("version"):
            version = manifest_entry["version"]
        source_type = catalog_entry.source_type if catalog_entry else "clinical_guideline"
        review_date = catalog_entry.review_date if catalog_entry else None
        effective_date = catalog_entry.effective_date if catalog_entry else None
        license_notes = catalog_entry.license_notes if catalog_entry else None

        chunk_count = indexed["chunks"] if indexed else manifest_entry.get("chunk_count", 0) if manifest_entry else 0
        indexed_flag = chunk_count > 0

        registry.append(
            SourceMetadata(
                source_id=source_id,
                title=title,
                source_url=url,
                domain=_domain_from_url(url),
                source_type=source_type,
                publication_year=publication_year,
                guideline_version=version,
                organization=organization,
                indexed=indexed_flag,
                chunk_count=chunk_count,
                page_count=manifest_entry.get("page_count") if manifest_entry else None,
                content_hash=manifest_entry.get("content_hash") if manifest_entry else None,
                last_ingested_at=manifest_entry.get("ingested_at") if manifest_entry else None,
                last_manifest_id=manifest_entry.get("manifest_id") if manifest_entry else None,
                license_notes=license_notes or "Public clinical guideline. Verify redistribution rights before committing PDFs.",
                review_date=review_date,
                effective_date=effective_date,
            )
        )

    return registry


def get_source_by_id(store: object, source_id: str) -> SourceMetadata | None:
    for source in build_source_registry(store):
        if source.source_id == source_id:
            return source
    return None
