from pathlib import Path
from unittest.mock import MagicMock, patch

from app.ingestion.pdf_loader import DEFAULT_RAW_DOCUMENT_DIR, extract_pdf_chunks, pdf_path_for
from app.models import IngestSource


def test_extract_pdf_chunks_preserves_page_numbers(tmp_path: Path):
    source = IngestSource(
        source_id="nice-ng136",
        title="Hypertension in adults",
        url="https://example.test/nice.pdf",
        organization="NICE",
        publication_year=2019,
    )
    pdf_path = tmp_path / "nice-ng136.pdf"
    pdf_path.write_bytes(b"%PDF-1.4")

    page_one = MagicMock()
    page_one.extract_text.return_value = "Stage 1 hypertension guidance on page one."
    page_two = MagicMock()
    page_two.extract_text.return_value = "Drug treatment thresholds on page two."

    mock_reader = MagicMock()
    mock_reader.pages = [page_one, page_two]

    with patch("app.ingestion.pdf_loader.PdfReader", return_value=mock_reader):
        chunks = extract_pdf_chunks(source, pdf_path)

    assert chunks
    page_numbers = sorted({chunk.page for chunk in chunks})
    assert page_numbers == [1, 2]
    assert all(chunk.chunk_id.startswith("nice-ng136:p1:") for chunk in chunks if chunk.page == 1)
    assert all(chunk.chunk_id.startswith("nice-ng136:p2:") for chunk in chunks if chunk.page == 2)
    assert all(chunk.organization == "NICE" for chunk in chunks)
    assert all(chunk.publication_year == 2019 for chunk in chunks)


def test_pdf_loader_uses_source_documents_raw_as_default_cache():
    source = IngestSource(
        source_id="who-hypertension",
        title="WHO hypertension guideline",
        url="https://example.test/who-hypertension.pdf",
    )

    path = pdf_path_for(source)

    assert DEFAULT_RAW_DOCUMENT_DIR == Path("data/source_documents/raw")
    assert path.parent == Path("data/source_documents/raw")
    assert path.name.startswith("who-hypertension-")
    assert path.suffix == ".pdf"
