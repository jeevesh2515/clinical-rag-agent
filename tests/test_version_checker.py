

from app.ingestion.chunker import TextChunk
from app.ingestion.sources import DEFAULT_SOURCES
from app.models import Citation, IngestSource, SourceMetadata
from app.tools.version_checker import check_source_freshness, compare_source_versions


class TestCitationProvenance:
    def test_citation_includes_source_url(self):
        citation = Citation(
            source_id="test",
            title="Test",
            source_url="https://example.com/guideline.pdf",
            page=1,
            chunk_id="test:p1:c001",
            quote="Test quote",
        )
        assert citation.source_url == "https://example.com/guideline.pdf"

    def test_citation_includes_retrieved_at(self):
        citation = Citation(
            source_id="test",
            title="Test",
            page=1,
            chunk_id="test:p1:c001",
            quote="Test quote",
            retrieved_at="2026-07-05T00:00:00+00:00",
        )
        assert citation.retrieved_at is not None

    def test_citation_includes_source_version(self):
        citation = Citation(
            source_id="test",
            title="Test",
            page=1,
            chunk_id="test:p1:c001",
            quote="Test quote",
            source_version="NG136",
        )
        assert citation.source_version == "NG136"

    def test_citation_includes_license_notes(self):
        citation = Citation(
            source_id="test",
            title="Test",
            page=1,
            chunk_id="test:p1:c001",
            quote="Test quote",
            license_notes="Public domain",
        )
        assert citation.license_notes == "Public domain"

    def test_citation_default_source_type(self):
        citation = Citation(
            source_id="test",
            title="Test",
            page=1,
            chunk_id="test:p1:c001",
            quote="Test quote",
        )
        assert citation.source_type == "clinical_guideline"


class TestTextChunkProvenance:
    def test_text_chunk_includes_new_fields(self):
        chunk = TextChunk(
            chunk_id="test:p1:c001",
            source_id="test",
            title="Test",
            page=1,
            section="Introduction",
            text="Some content",
            source_url="https://example.com/doc",
            chunk_index=1,
            source_type="clinical_guideline",
            source_version="v1.0",
            review_date="2025-01-01",
            effective_date="2023-06-01",
            license_notes="CC BY 4.0",
            ingested_at="2026-07-05T00:00:00",
        )
        assert chunk.source_type == "clinical_guideline"
        assert chunk.source_version == "v1.0"
        assert chunk.review_date == "2025-01-01"
        assert chunk.effective_date == "2023-06-01"
        assert chunk.license_notes == "CC BY 4.0"
        assert chunk.ingested_at == "2026-07-05T00:00:00"

    def test_text_chunk_defaults(self):
        chunk = TextChunk(
            chunk_id="test:p1:c001",
            source_id="test",
            title="Test",
            page=1,
            section=None,
            text="Content",
            source_url="",
            chunk_index=1,
        )
        assert chunk.source_type == "clinical_guideline"
        assert chunk.source_version is None
        assert chunk.review_date is None
        assert chunk.effective_date is None
        assert chunk.license_notes is None
        assert chunk.ingested_at is None


class TestVersionChecker:
    def test_source_freshness_returns_list(self, store):
        results = check_source_freshness(store)
        assert isinstance(results, list)

    def test_compare_source_versions_missing(self, store):
        result = compare_source_versions(store, "nonexistent", "v2")
        assert result["match"] is False
        assert result["indexed"] is False

    def test_source_metadata_includes_review_date(self):
        meta = SourceMetadata(
            source_id="test",
            title="Test",
            source_url="https://example.com",
            domain="example.com",
            review_date="2025-06-01",
            effective_date="2023-01-01",
        )
        assert meta.review_date == "2025-06-01"
        assert meta.effective_date == "2023-01-01"


class TestIngestSourceEnrichment:
    def test_default_sources_have_new_fields(self):
        for source in DEFAULT_SOURCES:
            assert source.source_type == "clinical_guideline"
            assert source.license_notes is not None

    def test_ingest_source_accepts_all_fields(self):
        source = IngestSource(
            source_id="test",
            title="Test",
            url="https://example.com",
            source_type="clinical_guideline",
            review_date="2025-01-01",
            effective_date="2023-01-01",
            license_notes="Custom license",
        )
        assert source.review_date == "2025-01-01"
        assert source.effective_date == "2023-01-01"
        assert source.license_notes == "Custom license"
