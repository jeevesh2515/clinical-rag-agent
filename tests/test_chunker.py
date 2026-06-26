from app.ingestion.chunker import chunk_page, normalize_text


def test_chunking_is_deterministic_and_preserves_metadata():
    text = "Stage 1 hypertension\n\nOffer lifestyle advice. Consider drug treatment when risk is high."
    first = chunk_page(
        source_id="nice-ng136",
        title="Hypertension in adults",
        source_url="https://example.test/doc.pdf",
        page=3,
        text=text,
        organization="NICE",
        publication_year=2019,
    )
    second = chunk_page(
        source_id="nice-ng136",
        title="Hypertension in adults",
        source_url="https://example.test/doc.pdf",
        page=3,
        text=text,
        organization="NICE",
        publication_year=2019,
    )
    assert first[0].chunk_id == second[0].chunk_id == "nice-ng136:p3:c001"
    assert first[0].page == 3
    assert first[0].source_url == "https://example.test/doc.pdf"
    assert first[0].text
    assert first[0].organization == "NICE"
    assert first[0].publication_year == 2019


def test_normalize_text_removes_empty_noise():
    assert normalize_text("a   b\n\n\n\nc") == "a b\n\nc"
