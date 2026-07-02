from pathlib import Path

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


def _router(tmp_path) -> QueryRouter:
    _write_index(tmp_path, [
        ("BP Categories", "diagnosis/bp-categories.md"),
        ("ACEi and ARB", "pharmacology/acei-arb.md"),
        ("Stage 1 HTN Protocol", "protocols/stage-1-htn-protocol.md"),
    ])
    _write_concept(
        tmp_path,
        "diagnosis/bp-categories.md",
        "BP Categories",
        "Normal: <120/80",
        tags=["bp", "classification", "diagnosis"],
    )
    _write_concept(
        tmp_path,
        "pharmacology/acei-arb.md",
        "ACEi and ARB",
        "ACE inhibitors",
        tags=["acei", "arb", "first-line"],
    )
    _write_concept(
        tmp_path,
        "protocols/stage-1-htn-protocol.md",
        "Stage 1 HTN Protocol",
        "Start monotherapy",
        tags=["stage-1", "first-line"],
    )
    retriever = OKFRetriever(tmp_path)
    return QueryRouter(retriever)


def test_router_routes_okf_via_tag_match(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("What is the target BP in CKD?")
    assert decision.path == "okf"
    assert "bp" in decision.matched_tags or "classification" in decision.matched_tags


def test_router_routes_okf_via_keywords(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("What is the first-line dosage for ACE inhibitors?")
    assert decision.path == "okf"


def test_router_routes_rag_when_no_okf_keywords(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("Has there been any research on resistant hypertension?")
    assert decision.path == "rag"


def test_router_routes_okf_then_rag_when_mixed(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("What is the dosing protocol for resistant hypertension? Any recent studies or case reports?")
    assert decision.path == "okf_then_rag"


def test_router_high_stakes_contraindication(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("Is ACEi contraindicated in pregnancy?")
    assert decision.path == "okf"


def test_router_returns_reason(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("What is the dose for amlodipine?")
    assert decision.reason


def test_router_matched_tags_populated_for_tag_match(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("first-line")
    assert len(decision.matched_tags) >= 1


def test_router_okf_concepts_populated_for_tag_match(tmp_path):
    router = _router(tmp_path)
    decision = router.classify("first-line")
    assert len(decision.okf_concepts) >= 1
