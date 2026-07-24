from unittest.mock import MagicMock, patch

from langsmith.schemas import Example, Run

from app.evaluation.langsmith_eval import (
    ALL_EVALUATORS,
    _parse_score,
    answer_relevancy_evaluator,
    citation_accuracy_evaluator,
    faithfulness_evaluator,
    harmfulness_evaluator,
    latency_evaluator,
    refusal_correctness_evaluator,
)


def test_parse_score_utility():
    assert _parse_score(" 1.0 ") == 1.0
    assert _parse_score("0.5") == 0.5
    assert _parse_score("invalid", default=0.2) == 0.2
    assert _parse_score("1.5") == 1.0  # capped at 1.0
    assert _parse_score("-0.5") == 0.0  # floored at 0.0


def test_citation_accuracy_evaluator():
    run = MagicMock(spec=Run)
    example = MagicMock(spec=Example)

    run.outputs = {"citations": [{"source_id": "nice-ng136"}]}
    res = citation_accuracy_evaluator(run, example)
    assert res.key == "citation_accuracy"
    assert res.score == 1.0

    run.outputs = {"citations": []}
    res_empty = citation_accuracy_evaluator(run, example)
    assert res_empty.score == 0.0


def test_refusal_correctness_evaluator():
    run = MagicMock(spec=Run)
    example = MagicMock(spec=Example)

    example.inputs = {"expected_refusal": True}
    run.outputs = {"safety": {"refusal_triggered": True}}
    res = refusal_correctness_evaluator(run, example)
    assert res.key == "refusal_correctness"
    assert res.score == 1.0

    run.outputs = {"safety": {"refusal_triggered": False}}
    res_mismatch = refusal_correctness_evaluator(run, example)
    assert res_mismatch.score == 0.0


def test_latency_evaluator():
    run = MagicMock(spec=Run)
    example = MagicMock(spec=Example)

    run.outputs = {"latency_ms": {"classify": 50, "retrieve": 100, "generate": 150}}
    res = latency_evaluator(run, example)
    assert res.key == "latency_ms"
    assert res.score == 300


def test_llm_evaluators_with_dummy_llm():
    run = MagicMock(spec=Run)
    example = MagicMock(spec=Example)

    example.inputs = {"question": "What is the BP target for CKD Stage 3?"}
    run.outputs = {
        "answer": "Target blood pressure for CKD Stage 3 is < 130/80 mmHg based on NICE guidelines.",
        "retrieval": {"results": [{"text": "NICE NG136 recommends BP < 130/80 for CKD patients."}]},
    }

    with patch("app.evaluation.langsmith_eval._call_eval_llm", return_value="1.0"):
        res_f = faithfulness_evaluator(run, example)
        assert res_f.key == "faithfulness"
        assert res_f.score == 1.0

        res_r = answer_relevancy_evaluator(run, example)
        assert res_r.key == "answer_relevancy"
        assert res_r.score == 1.0

        res_h = harmfulness_evaluator(run, example)
        assert res_h.key == "harmfulness"
        assert res_h.score == 1.0


def test_all_evaluators_list():
    assert len(ALL_EVALUATORS) == 6
