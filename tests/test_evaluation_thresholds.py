"""CI quality gates for evaluation metrics.

These tests run deterministic evaluation against all datasets and assert
that key quality metrics meet their thresholds. They fail the build if a
metric regresses — catching model behavior drift before deployment.

Thresholds are defined in app/evaluation/metrics.py (METRIC_THRESHOLDS).
"""


import pytest

from app.evaluation.metrics import METRIC_THRESHOLDS
from app.evaluation.run import EVAL_DATASETS, run_single_dataset

pytestmark = pytest.mark.skip(reason="requires real API keys for agent invocation")


@pytest.fixture
def refusal_result():
    path = EVAL_DATASETS["refusals"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


@pytest.fixture
def tool_routing_result():
    path = EVAL_DATASETS["tool_routing"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


@pytest.fixture
def guideline_result():
    path = EVAL_DATASETS["guideline_questions"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


@pytest.fixture
def prompt_injection_result():
    path = EVAL_DATASETS["prompt_injection"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


@pytest.fixture
def insufficient_evidence_result():
    path = EVAL_DATASETS["insufficient_evidence"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


@pytest.fixture
def workflow_result():
    path = EVAL_DATASETS["workflow_cases"]
    if not path.exists():
        pytest.skip(f"Dataset not found: {path}")
    return run_single_dataset(path)


class TestRefusalGate:
    """Safety: every unsafe request must be refused."""

    def test_refusal_correctness_threshold(self, refusal_result):
        threshold = METRIC_THRESHOLDS["refusal_correctness"]
        score = refusal_result["metrics"]["refusal_correctness"]
        assert score >= threshold, (
            f"Refusal correctness {score:.3f} below threshold {threshold:.3f}. "
            f"Check safety classifier for regression."
        )

    def test_refusal_precision_threshold(self, refusal_result):
        threshold = METRIC_THRESHOLDS["refusal_precision"]
        score = refusal_result["metrics"]["refusal_precision"]
        assert score >= threshold, (
            f"Refusal precision {score:.3f} below threshold {threshold:.3f}. "
            f"Check for false positive refusals."
        )


class TestToolRoutingGate:
    """Tools: calculator and DB routing must be accurate."""

    def test_tool_selection_accuracy_threshold(self, tool_routing_result):
        threshold = METRIC_THRESHOLDS["tool_selection_accuracy"]
        score = tool_routing_result["metrics"]["tool_selection_accuracy"]
        assert score >= threshold, (
            f"Tool selection accuracy {score:.3f} below threshold {threshold:.3f}. "
            f"Check calculator and DB lookup routing."
        )

    def test_tool_routing_intent_accuracy(self, tool_routing_result):
        threshold = METRIC_THRESHOLDS["intent_accuracy"]
        score = tool_routing_result["metrics"]["intent_accuracy"]
        assert score >= threshold, (
            f"Tool routing intent accuracy {score:.3f} below threshold {threshold:.3f}."
        )


class TestGuidelineGate:
    """Citations: answerable questions must cite sources."""

    def test_citation_presence_threshold(self, guideline_result):
        threshold = METRIC_THRESHOLDS["citation_presence_rate"]
        score = guideline_result["metrics"]["citation_presence_rate"]
        assert score >= threshold, (
            f"Citation presence rate {score:.3f} below threshold {threshold:.3f}. "
            f"Guideline questions must produce citations."
        )


class TestPromptInjectionGate:
    """Safety: prompt injection attempts must be detected and refused."""

    def test_prompt_injection_detection_threshold(self, prompt_injection_result):
        threshold = METRIC_THRESHOLDS["prompt_injection_detection_rate"]
        score = prompt_injection_result["metrics"]["prompt_injection_detection_rate"]
        assert score >= threshold, (
            f"Prompt injection detection rate {score:.3f} below threshold {threshold:.3f}. "
            f"Check prompt injection patterns in classifier."
        )


class TestInsufficientEvidenceGate:
    """Graceful degradation: out-of-domain questions must be handled."""

    def test_insufficient_evidence_intent_accuracy(self, insufficient_evidence_result):
        threshold = METRIC_THRESHOLDS["intent_accuracy"]
        score = insufficient_evidence_result["metrics"]["intent_accuracy"]
        assert score >= threshold, (
            f"Insufficient evidence intent accuracy {score:.3f} below threshold {threshold:.3f}. "
            f"Out-of-domain questions are not being classified correctly."
        )


class TestWorkflowGate:
    """Workflow: case-aware queries must detect care gaps."""

    def test_workflow_care_gap_detection(self, workflow_result):
        threshold = METRIC_THRESHOLDS["care_gap_detection_rate"]
        score = workflow_result["metrics"].get("care_gap_detection_rate", 0.0)
        assert score >= threshold, (
            f"Care gap detection rate {score:.3f} below threshold {threshold:.3f}."
        )


class TestAllDatasetsExist:
    """All evaluation datasets must be present."""

    def test_all_datasets_exist(self):
        missing = [name for name, path in EVAL_DATASETS.items() if not path.exists()]
        assert not missing, f"Missing evaluation datasets: {missing}"
