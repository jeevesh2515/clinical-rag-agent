from app.ingestion.source_registry import build_source_registry, get_source_by_id


def test_source_registry_lists_default_sources(settings, store):
    registry = build_source_registry(store)
    source_ids = {source.source_id for source in registry}
    assert "nice-ng136" in source_ids
    assert "who-hypertension-pharmacological" in source_ids
    assert "cdc-community-clinical-linkages" in source_ids


def test_source_registry_marks_indexed_sources(settings, store):
    registry = build_source_registry(store)
    indexed = [source for source in registry if source.source_id == "nice-ng136"][0]
    assert indexed.indexed is True
    assert indexed.chunk_count >= 1
    assert indexed.title
    assert indexed.organization == "" or indexed.organization
    assert indexed.source_type == "clinical_guideline"


def test_get_source_by_id(settings, store):
    source = get_source_by_id(store, "nice-ng136")
    assert source is not None
    assert source.source_id == "nice-ng136"
    assert get_source_by_id(store, "missing-source") is None
