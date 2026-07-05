from datetime import datetime, timezone

from app.ingestion.source_registry import build_source_registry
from app.retrieval.store import HybridStore


def check_source_freshness(store: HybridStore) -> list[dict]:
    """Check each indexed source and flag if it may be outdated.

    Returns a list of dicts with source_id, title, version, last_ingested_at,
    review_date, effective_date, and a freshness status.
    """
    sources = build_source_registry(store)
    now = datetime.now(timezone.utc)
    results: list[dict] = []

    for source in sources:
        if not source.indexed:
            continue

        status = "current"
        notes: list[str] = []

        if source.review_date:
            try:
                review_dt = datetime.fromisoformat(source.review_date)
                if review_dt <= now:
                    status = "review_overdue"
                    notes.append(f"Review was due {source.review_date}")
                elif (review_dt - now).days <= 90:
                    status = "review_approaching"
                    days_to_review = (review_dt - now).days
                    notes.append(f"Review due {source.review_date} ({days_to_review} days)")
            except (ValueError, TypeError):
                notes.append(f"Invalid review_date: {source.review_date}")

        if source.last_ingested_at:
            try:
                ingested_dt = datetime.fromisoformat(source.last_ingested_at)
                days_since_ingest = (now - ingested_dt).days
                if days_since_ingest > 365:
                    status = "stale"
                    notes.append(f"Last ingested {days_since_ingest} days ago")
                elif days_since_ingest > 180:
                    if status != "review_overdue":
                        status = "aging"
                    notes.append(f"Last ingested {days_since_ingest} days ago")
            except (ValueError, TypeError):
                notes.append(f"Invalid ingested_at: {source.last_ingested_at}")

        results.append({
            "source_id": source.source_id,
            "title": source.title,
            "version": source.guideline_version,
            "source_type": source.source_type,
            "last_ingested_at": source.last_ingested_at,
            "review_date": source.review_date,
            "effective_date": source.effective_date,
            "chunk_count": source.chunk_count,
            "freshness_status": status,
            "notes": notes,
        })

    return results


def compare_source_versions(
    store: HybridStore, source_id: str, expected_version: str
) -> dict:
    """Compare indexed source version against an expected version string."""
    sources = build_source_registry(store)
    for source in sources:
        if source.source_id == source_id:
            indexed_version = source.guideline_version
            return {
                "source_id": source_id,
                "title": source.title,
                "indexed_version": indexed_version,
                "expected_version": expected_version,
                "match": indexed_version == expected_version,
                "indexed": source.indexed,
                "last_ingested_at": source.last_ingested_at,
            }
    return {
        "source_id": source_id,
        "indexed_version": None,
        "expected_version": expected_version,
        "match": False,
        "indexed": False,
        "last_ingested_at": None,
    }
