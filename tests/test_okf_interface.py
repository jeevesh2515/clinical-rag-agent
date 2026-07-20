from pathlib import Path
from unittest.mock import MagicMock

from app.okf.interface import KnowledgeInterface
from app.okf.retriever import OKFRetriever
from app.okf.router import QueryRouter


def _write_index(root: Path, entries: list[tuple[str, str]]):
    lines = ["| Title | File |", "|-------|------|"]
    for title, path in entries:
        lines.append(f"| [{title}]({path}) | |")
    (root / "INDEX.md").write_text("\n".join(lines) + "\n")


def _write_concept(root: Path, rel_path: str, title: str, content: str, tags: list[str] | None = None):
    full = root / rel_path
    full.parent.mkdir(parents=True, exist_ok=True)
    tags_str = ""
    if tags:
        tags_str = "tags:\n  - " + "\n  - ".join(tags) + "\n"
    full.write_text(
        f"---\ntitle: {title}\ntype: concept\n{tags_str}resource: https://example.test\n---\n\n{content}"
    )


def _build_interface(tmp_path) -> KnowledgeInterface:
    _write_index(tmp_path, [("BP Categories", "diagnosis/bp-categories.md")])
    _write_concept(
        tmp_path,
        "diagnosis/bp-categories.md",
        "BP Categories",
        "Normal: <120/80",
        tags=["bp", "classification"],
    )
    retriever = OKFRetriever(tmp_path)
    router = QueryRouter(retriever)
    mock_rag = MagicMock()
    mock_rag.query.return_value = []
    return KnowledgeInterface(retriever, router, mock_rag)


def test_interface_search_okf_path(tmp_path):
    interface = _build_interface(tmp_path)
    result = interface.search("What are the BP categories?")
    assert result.decision is not None
    assert result.decision.path == "okf_then_rag"
    assert len(result.okf_docs) >= 1


def test_interface_search_rag_fallback(tmp_path):
    interface = _build_interface(tmp_path)
    result = interface.search("Has there been any research on this?")
    assert result.decision is not None
    assert result.decision.path == "rag"


def test_interface_merged_content_includes_okf_label(tmp_path):
    interface = _build_interface(tmp_path)
    result = interface.search("BP categories")
    assert "CANONICAL KNOWLEDGE" in result.merged_content


def test_interface_rag_store_called_when_path_is_rag(tmp_path):
    interface = _build_interface(tmp_path)
    interface.search("Has there been any research on resistant hypertension?")
    interface._rag.query.assert_called_once()  # type: ignore[attr-defined]
