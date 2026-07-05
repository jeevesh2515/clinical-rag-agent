import json

from app.evaluation.run import run_single_dataset


def test_evaluation_writes_scores_and_thresholds(tmp_path):
    dataset = tmp_path / "golden.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "question": "What should the agent do when indexed evidence is insufficient?",
                "expected_intent": "guideline_question",
                "ground_truth": "It should say evidence is insufficient.",
            }
        )
        + "\n"
    )

    result = run_single_dataset(dataset)

    assert "metrics" in result
    assert "intent_accuracy" in result["metrics"]
    assert "refusal_correctness" in result["metrics"]
    assert "citation_presence_rate" in result["metrics"]
    assert "tool_selection_accuracy" in result["metrics"]
    assert "ragas_scores" in result
    assert "faithfulness" in result["ragas_scores"]
    assert "latency_seconds" in result
    assert isinstance(result["dataset_size"], int)
    assert isinstance(result["passed_thresholds"], dict)
