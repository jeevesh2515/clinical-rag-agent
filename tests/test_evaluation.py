import json

from app.evaluation.run import run_evaluation


def test_evaluation_writes_scores_and_thresholds(tmp_path):
    dataset = tmp_path / "golden.jsonl"
    output = tmp_path / "results.json"
    dataset.write_text(
        json.dumps(
            {
                "question": "What should the agent do when indexed evidence is insufficient?",
                "ground_truth": "It should say evidence is insufficient.",
            }
        )
        + "\n"
    )

    result = run_evaluation(dataset, output)

    assert output.exists()
    assert result["mode"] == "ragas-compatible-local-proxy"
    assert "faithfulness" in result["scores"]
    assert "answer_relevancy" in result["scores"]
    assert "context_precision" in result["thresholds"]
    assert isinstance(result["passed_thresholds"]["faithfulness"], bool)
