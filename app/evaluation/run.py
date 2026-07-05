import argparse
import json
from pathlib import Path
from statistics import mean
from time import time

from app.api.dependencies import get_agent, get_store
from app.core.config import get_settings
from app.evaluation.metrics import METRIC_THRESHOLDS, compute_dataset_metrics
from app.ingestion.pdf_loader import ingest_sources
from app.ingestion.sources import DEFAULT_SOURCES


EVAL_DATASETS: dict[str, Path] = {
    "guideline_questions": Path("data/eval/golden_guideline_questions.jsonl"),
    "workflow_cases": Path("data/eval/golden_workflow_cases.jsonl"),
    "refusals": Path("data/eval/golden_refusals.jsonl"),
    "prompt_injection": Path("data/eval/golden_prompt_injection.jsonl"),
    "insufficient_evidence": Path("data/eval/golden_insufficient_evidence.jsonl"),
    "tool_routing": Path("data/eval/golden_tool_routing.jsonl"),
}


def load_dataset(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def lexical_relevancy(question: str, answer: str) -> float:
    question_terms = {term.lower() for term in question.split() if len(term) > 3}
    answer_terms = {term.lower().strip(".,;:[]") for term in answer.split()}
    if not question_terms:
        return 0.0
    return len(question_terms & answer_terms) / len(question_terms)


def run_single_dataset(
    dataset_path: Path,
    *,
    ingest_defaults: bool = False,
) -> dict:
    """Run evaluation on a single dataset and return deterministic metrics.

    Args:
        dataset_path: Path to the JSONL dataset file.
        ingest_defaults: Whether to ingest default PDFs first.

    Returns:
        Dataset-level evaluation result with metrics, rows, and latency.
    """
    settings = get_settings()
    if ingest_defaults:
        store = get_store()
        if store.chunk_count == 0:
            result = ingest_sources(DEFAULT_SOURCES)
            store.upsert_chunks(result.chunks)
    agent = get_agent()
    dataset = load_dataset(dataset_path)
    responses = []
    rows = []
    start_time = time()

    for item in dataset:
        case_id = item.get("expected_case_id") or item.get("case_id")
        response = agent.invoke(
            item["question"],
            case_id=case_id,
            alpha=settings.default_alpha,
            top_k=min(settings.default_top_k, 10),
            rerank_top_n=min(settings.default_rerank_top_n, 4),
        )
        responses.append(response)
        rows.append(
            {
                "question": item["question"],
                "answer": response.answer,
                "intent": response.intent,
                "refusal_reason": response.refusal_reason,
                "tools_used": response.tools_used,
                "citations": [
                    {"source_id": c.source_id, "chunk_id": c.chunk_id, "quote": c.quote}
                    for c in response.citations
                ],
                "care_gaps": response.care_gaps,
                "confidence": response.confidence,
                "refusal_triggered": response.safety.refusal_triggered,
                "prompt_injection_detected": response.safety.prompt_injection_detected,
                "ground_truth": item.get("ground_truth", ""),
                "faithfulness": 1.0 if response.citations or "could not find" in response.answer.lower() else 0.0,
                "answer_relevancy": lexical_relevancy(item["question"], response.answer),
                "context_precision": min(1.0, len(response.citations) / 2) if response.citations else 0.0,
                "context_recall": 1.0 if response.citations else 0.0,
            }
        )

    elapsed = time() - start_time

    metrics = compute_dataset_metrics(responses, dataset)

    ragas_scores = {
        "faithfulness": average(row["faithfulness"] for row in rows),
        "answer_relevancy": average(row["answer_relevancy"] for row in rows),
        "context_precision": average(row["context_precision"] for row in rows),
        "context_recall": average(row["context_recall"] for row in rows),
    }

    passed = {
        metric: metrics.get(metric, 0.0) >= threshold
        for metric, threshold in METRIC_THRESHOLDS.items()
    }

    return {
        "dataset_size": len(dataset),
        "latency_seconds": round(elapsed, 2),
        "avg_latency_per_query": round(elapsed / len(dataset), 2) if dataset else 0.0,
        "metrics": metrics,
        "ragas_scores": ragas_scores,
        "thresholds": dict(METRIC_THRESHOLDS),
        "passed_thresholds": passed,
        "rows": rows,
    }


def average(values) -> float:
    values = list(values)
    return mean(values) if values else 0.0


def run_full_evaluation(
    out: Path | None = None,
    *,
    ingest_defaults: bool = False,
) -> dict:
    """Run evaluation across all datasets.

    Args:
        out: Optional path for the combined results JSON file.
        ingest_defaults: Whether to ingest default PDFs before evaluation.

    Returns:
        Combined evaluation result with per-dataset breakdowns and aggregate metrics.
    """
    datasets_results: dict[str, dict] = {}
    all_metrics: dict[str, list[float]] = {}

    for dataset_name, dataset_path in EVAL_DATASETS.items():
        if not dataset_path.exists():
            datasets_results[dataset_name] = {
                "error": f"Dataset not found: {dataset_path}",
                "dataset_size": 0,
                "metrics": {},
            }
            continue
        result = run_single_dataset(dataset_path, ingest_defaults=ingest_defaults)
        datasets_results[dataset_name] = result
        for metric, score in result.get("metrics", {}).items():
            if metric not in all_metrics:
                all_metrics[metric] = []
            all_metrics[metric].append(score)

    aggregate_metrics = {
        metric: average(scores) for metric, scores in all_metrics.items()
    }
    aggregate_passed = {
        metric: aggregate_metrics.get(metric, 0.0) >= METRIC_THRESHOLDS.get(metric, 0.0)
        for metric in aggregate_metrics
    }

    summary = {
        "mode": "deterministic-multi-dataset",
        "note": (
            "Multi-dataset evaluation with deterministic proxy metrics. "
            "Full RAGAS metrics require configured evaluator LLM credentials."
        ),
        "datasets": datasets_results,
        "aggregate": {
            "metrics": aggregate_metrics,
            "thresholds": dict(METRIC_THRESHOLDS),
            "passed_thresholds": aggregate_passed,
            "all_passed": all(aggregate_passed.values()),
        },
        "corpus": {
            "ingest_defaults": ingest_defaults,
            "documents": get_store().document_count,
            "chunks": get_store().chunk_count,
        },
    }

    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(summary, indent=2))

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clinical RAG evaluation: run all datasets and compute deterministic metrics."
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=None,
        help="Single dataset path (optional; runs all datasets by default).",
    )
    parser.add_argument("--out", type=Path, default=Path("data/eval/results.json"))
    parser.add_argument(
        "--ingest-defaults",
        action="store_true",
        help="Download and ingest the default public clinical PDFs before evaluation.",
    )
    args = parser.parse_args()

    if args.dataset:
        result = run_single_dataset(args.dataset, ingest_defaults=args.ingest_defaults)
    else:
        result = run_full_evaluation(args.out, ingest_defaults=args.ingest_defaults)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
