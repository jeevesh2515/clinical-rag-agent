import argparse
import json
from pathlib import Path
from statistics import mean

from app.api.dependencies import get_agent, get_store
from app.core.config import get_settings
from app.ingestion.pdf_loader import ingest_sources
from app.ingestion.sources import DEFAULT_SOURCES


def load_dataset(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def lexical_relevancy(question: str, answer: str) -> float:
    question_terms = {term.lower() for term in question.split() if len(term) > 3}
    answer_terms = {term.lower().strip(".,;:[]") for term in answer.split()}
    if not question_terms:
        return 0.0
    return len(question_terms & answer_terms) / len(question_terms)


def run_evaluation(dataset: Path, out: Path, *, ingest_defaults: bool = False) -> dict:
    settings = get_settings()
    if ingest_defaults:
        store = get_store()
        if store.chunk_count == 0:
            result = ingest_sources(DEFAULT_SOURCES)
            store.upsert_chunks(result.chunks)
    agent = get_agent()
    rows = []
    for item in load_dataset(dataset):
        response = agent.invoke(
            item["question"],
            alpha=settings.default_alpha,
            top_k=min(settings.default_top_k, 10),
            rerank_top_n=min(settings.default_rerank_top_n, 4),
        )
        rows.append(
            {
                "question": item["question"],
                "answer": response.answer,
                "contexts": [citation.quote for citation in response.citations],
                "ground_truth": item.get("ground_truth", ""),
                "faithfulness": 1.0 if response.citations or "could not find" in response.answer.lower() else 0.0,
                "answer_relevancy": lexical_relevancy(item["question"], response.answer),
                "context_precision": min(1.0, len(response.citations) / 2) if response.citations else 0.0,
                "context_recall": 1.0 if response.citations else 0.0,
            }
        )
    scores = {
        "faithfulness": average(row["faithfulness"] for row in rows),
        "answer_relevancy": average(row["answer_relevancy"] for row in rows),
        "context_precision": average(row["context_precision"] for row in rows),
        "context_recall": average(row["context_recall"] for row in rows),
    }
    summary = {
        "mode": "ragas-compatible-local-proxy",
        "note": (
            "Local mode computes deterministic proxy metrics. Use the notebook or extend this "
            "CLI with configured evaluator LLMs for full RAGAS metric execution."
        ),
        "thresholds": {
            "faithfulness": 0.85,
            "answer_relevancy": 0.80,
            "context_precision": 0.75,
        },
        "corpus": {
            "ingest_defaults": ingest_defaults,
            "documents": get_store().document_count,
            "chunks": get_store().chunk_count,
        },
        "passed_thresholds": {
            "faithfulness": scores["faithfulness"] >= 0.85,
            "answer_relevancy": scores["answer_relevancy"] >= 0.80,
            "context_precision": scores["context_precision"] >= 0.75,
        },
        "rows": rows,
        "scores": scores,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, indent=2))
    return summary


def average(values) -> float:
    values = list(values)
    return mean(values) if values else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--ingest-defaults",
        action="store_true",
        help="Download and ingest the default public clinical PDFs before evaluation.",
    )
    args = parser.parse_args()
    print(json.dumps(run_evaluation(args.dataset, args.out, ingest_defaults=args.ingest_defaults), indent=2))


if __name__ == "__main__":
    main()
