from pathlib import Path

from app.okf.retriever import OKFRetriever


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


def test_retriever_loads_index(tmp_path):
    _write_index(tmp_path, [("BP Categories", "diagnosis/bp-categories.md")])
    _write_concept(tmp_path, "diagnosis/bp-categories.md", "BP Categories", "Normal: <120/80")
    retriever = OKFRetriever(tmp_path)
    assert len(retriever.get_concept_map()) == 1
    doc = retriever.get_concept("diagnosis/bp-categories")
    assert doc is not None
    assert doc.title == "BP Categories"


def test_retriever_retrieve_by_tag(tmp_path):
    _write_index(tmp_path, [("ACEi and ARB", "pharmacology/acei-arb.md")])
    _write_concept(
        tmp_path,
        "pharmacology/acei-arb.md",
        "ACEi and ARB",
        "ACE inhibitors and ARBs",
        tags=["acei", "arb", "first-line"],
    )
    retriever = OKFRetriever(tmp_path)
    results = retriever.retrieve("acei")
    assert len(results) == 1
    assert results[0].title == "ACEi and ARB"


def test_retriever_retrieve_by_title_fallback(tmp_path):
    _write_index(tmp_path, [("Thiazide Diuretics", "pharmacology/thiazide-diuretics.md")])
    _write_concept(
        tmp_path,
        "pharmacology/thiazide-diuretics.md",
        "Thiazide Diuretics",
        "Thiazide and thiazide-like diuretics",
        tags=["diuretic", "first-line"],
    )
    retriever = OKFRetriever(tmp_path)
    results = retriever.retrieve("thiazide")
    assert len(results) == 1
    assert results[0].title == "Thiazide Diuretics"


def test_retriever_retrieve_normalizes_punctuation(tmp_path):
    _write_index(tmp_path, [("BP Categories", "diagnosis/bp-categories.md")])
    _write_concept(
        tmp_path,
        "diagnosis/bp-categories.md",
        "BP Categories",
        "BP classification table",
        tags=["bp", "classification", "diagnosis"],
    )
    retriever = OKFRetriever(tmp_path)
    results = retriever.retrieve("BP-categories?")
    assert len(results) == 1
    assert results[0].title == "BP Categories"


def test_retriever_no_match_returns_empty(tmp_path):
    _write_index(tmp_path, [("BP Categories", "diagnosis/bp-categories.md")])
    _write_concept(tmp_path, "diagnosis/bp-categories.md", "BP Categories", "Normal: <120/80")
    retriever = OKFRetriever(tmp_path)
    results = retriever.retrieve("cancer")
    assert results == []


def test_retriever_get_section_by_tag(tmp_path):
    _write_index(tmp_path, [("HTN + CKD", "comorbidities/htn-and-ckd.md")])
    _write_concept(
        tmp_path,
        "comorbidities/htn-and-ckd.md",
        "HTN + CKD",
        "Target BP in CKD",
        tags=["ckd", "comorbidity"],
    )
    retriever = OKFRetriever(tmp_path)
    results = retriever.get_section("ckd")
    assert len(results) == 1
    assert results[0].title == "HTN + CKD"


def test_retriever_resolve_links(tmp_path):
    _write_index(tmp_path, [
        ("ACEi and ARB", "pharmacology/acei-arb.md"),
        ("First-Line Drug Classes", "pharmacology/first-line-drug-classes.md"),
    ])
    _write_concept(
        tmp_path,
        "pharmacology/acei-arb.md",
        "ACEi and ARB",
        "ACE inhibitors. See [[pharmacology/first-line-drug-classes]] for more.",
        tags=["acei"],
    )
    _write_concept(
        tmp_path,
        "pharmacology/first-line-drug-classes.md",
        "First-Line Drug Classes",
        "ACEi, ARB, CCB, Thiazide",
        tags=["first-line"],
    )
    retriever = OKFRetriever(tmp_path)
    doc = retriever.get_concept("pharmacology/acei-arb")
    assert doc is not None
    resolved = retriever.resolve_links(doc.content, max_hops=1)
    assert "First-Line Drug Classes" in resolved


def test_retriever_list_all_concepts(tmp_path):
    _write_index(tmp_path, [
        ("BP Categories", "diagnosis/bp-categories.md"),
        ("ACEi and ARB", "pharmacology/acei-arb.md"),
    ])
    _write_concept(tmp_path, "diagnosis/bp-categories.md", "BP Categories", "Normal: <120/80")
    _write_concept(tmp_path, "pharmacology/acei-arb.md", "ACEi and ARB", "ACE inhibitors")
    retriever = OKFRetriever(tmp_path)
    all_docs = retriever.list_all_concepts()
    assert len(all_docs) == 2
