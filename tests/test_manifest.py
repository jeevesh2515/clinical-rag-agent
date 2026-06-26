from datetime import datetime
from pathlib import Path

from app.ingestion.manifest import (
    DEFAULT_MANIFEST_DIR,
    IngestionManifest,
    ManifestEntry,
    build_manifest_id,
    load_manifest,
    save_manifest,
)


def test_build_manifest_id_is_iso_timestamp_based():
    mid = build_manifest_id()
    assert mid.startswith("ingest-")
    # e.g. ingest-20260101T120000
    timestamp_part = mid.replace("ingest-", "")
    datetime.strptime(timestamp_part, "%Y%m%dT%H%M%S")


def test_save_and_load_manifest(tmp_path: Path):
    entry = ManifestEntry(
        source_id="nice-ng136",
        title="Hypertension in adults",
        url="https://example.test/nice.pdf",
        organization="NICE",
        publication_year=2019,
        version="NG136",
        page_count=5,
        chunk_count=12,
        content_hash="abc123def456",
        ingested_at="2026-01-01T12:00:00",
    )
    manifest = IngestionManifest(
        manifest_id="ingest-20260101T120000",
        ingested_at="2026-01-01T12:00:00",
        entries=[entry],
        total_chunks=12,
        total_documents=1,
    )

    saved_path = save_manifest(manifest, manifest_dir=tmp_path)
    assert saved_path.exists()
    assert saved_path.name == "ingest-20260101T120000.json"

    loaded = load_manifest("ingest-20260101T120000", manifest_dir=tmp_path)
    assert loaded is not None
    assert loaded.manifest_id == "ingest-20260101T120000"
    assert loaded.total_chunks == 12
    assert loaded.total_documents == 1
    assert len(loaded.entries) == 1
    assert loaded.entries[0].source_id == "nice-ng136"
    assert loaded.entries[0].organization == "NICE"
    assert loaded.entries[0].publication_year == 2019
    assert loaded.entries[0].version == "NG136"
    assert loaded.entries[0].content_hash == "abc123def456"
    assert loaded.entries[0].page_count == 5
    assert loaded.entries[0].chunk_count == 12


def test_load_manifest_returns_none_for_missing(tmp_path: Path):
    assert load_manifest("nonexistent", manifest_dir=tmp_path) is None


def test_manifest_omits_empty_fields(tmp_path: Path):
    entry = ManifestEntry(
        source_id="test",
        title="Test",
        url="https://example.test/doc.pdf",
        content_hash="hash123",
        ingested_at="2026-06-01T00:00:00",
    )
    manifest = IngestionManifest(
        manifest_id="ingest-20260601T000000",
        ingested_at="2026-06-01T00:00:00",
        entries=[entry],
        total_chunks=0,
        total_documents=1,
    )
    path = save_manifest(manifest, manifest_dir=tmp_path)
    raw = path.read_text()
    assert "organization" not in raw  # empty string omitted
    assert "publication_year" not in raw  # None omitted
    assert "version" not in raw  # None omitted
    assert "error" not in raw  # None omitted


def test_default_manifest_dir():
    assert DEFAULT_MANIFEST_DIR == Path("data/source_documents/manifests")
