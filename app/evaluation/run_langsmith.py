"""LangSmith evaluation runner.

Upload datasets to LangSmith, run LLM-as-Judge + code-based evaluators,
and view results in the LangSmith dashboard.

Requires LANGSMITH_API_KEY and at least one LLM API key for judge scoring.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langsmith import Client, evaluate

from app.evaluation.langsmith_eval import ALL_EVALUATORS
from app.evaluation.run import load_dataset

from app.core.config import get_settings

logger = logging.getLogger(__name__)

LANGSMITH_DS_PREFIX = "clinical-rag"


def _get_client() -> Client:
    settings = get_settings()
    key = settings.langsmith_api_key or settings.langchain_api_key
    if key:
        key = key.strip()
    return Client(api_key=key)


def create_or_update_dataset(dataset_path: Path, dataset_name: str) -> str:
    client = _get_client()
    items = load_dataset(dataset_path)
    try:
        ds = client.create_dataset(dataset_name=dataset_name, description=f"Clinical RAG: {dataset_name}")
    except Exception:
        ds = client.read_dataset(dataset_name=dataset_name)
    existing = set()
    for ex in client.list_examples(dataset_id=ds.id):
        existing.add(ex.inputs.get("question", ""))
    for item in items:
        if item.get("question", "") not in existing:
            client.create_example(
                inputs={"question": item["question"]},
                outputs={
                    "ground_truth": item.get("ground_truth", ""),
                    "expected_intent": item.get("expected_intent", ""),
                    "expected_refusal": item.get("expected_refusal_reason") is not None,
                },
                dataset_id=ds.id,
            )
    return str(ds.id)


def upload_all_datasets(datasets_dir: Path = Path("data/eval")) -> dict[str, str]:
    ids = {}
    for fpath in sorted(datasets_dir.glob("golden_*.jsonl")):
        name = fpath.stem.replace("golden_", f"{LANGSMITH_DS_PREFIX}-").replace("_", "-")
        ds_id = create_or_update_dataset(fpath, name)
        ids[name] = ds_id
        logger.info("Uploaded dataset %s → %s", name, ds_id)
    return ids


def _run_agent(inputs: dict) -> dict:
    from app.api.dependencies import get_agent
    return get_agent().invoke(inputs["question"]).model_dump()


def run_langsmith_evaluation(dataset_name: str | None = None):
    results = evaluate(
        _run_agent,
        data=dataset_name or f"{LANGSMITH_DS_PREFIX}-guideline-questions",
        evaluators=ALL_EVALUATORS,
        experiment_prefix="clinical-rag-eval",
        client=_get_client(),
        metadata={"version": "1.0", "type": "llm-as-judge"},
    )
    return results


if __name__ == "__main__":
    datasets_dir = Path(__file__).parent.parent.parent / "data" / "eval"
    ids = upload_all_datasets(datasets_dir)
    logger.info("Uploaded %d datasets. IDs: %s", len(ids), ids)
    results = run_langsmith_evaluation()
    print("LangSmith evaluation complete:", results)
