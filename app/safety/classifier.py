import re
from dataclasses import dataclass
from typing import Literal

QueryIntent = Literal[
    "guideline_question",
    "workflow_question",
    "calculator_question",
    "unsafe_medical_advice_request",
    "insufficient_evidence",
    "out_of_domain",
]

RefusalReason = Literal[
    "diagnosis_request",
    "prescribing_request",
    "emergency_triage_request",
    "medication_dose_request",
    "ignore_symptom_request",
    "prompt_injection_request",
]


@dataclass(frozen=True)
class QueryClassification:
    intent: QueryIntent
    refusal_reason: RefusalReason | None = None
    prompt_injection_detected: bool = False

    @property
    def is_unsafe(self) -> bool:
        return self.refusal_reason is not None


PROMPT_INJECTION_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in [
        r"ignore (all )?(previous|prior|above) instructions",
        r"reveal (the )?(system|developer) (prompt|message|instructions)",
        r"you are now (in )?(developer|admin|root) mode",
        r"jailbreak",
        r"bypass (the )?(safety|guardrail|policy)",
    ]
]

REFUSAL_PATTERNS: list[tuple[RefusalReason, re.Pattern[str]]] = [
    (
        "prompt_injection_request",
        re.compile(
            r"ignore (all )?(previous|prior|above) instructions|reveal (the )?(system|developer) "
            r"(prompt|message|instructions)|jailbreak|bypass (the )?(safety|guardrail|policy)",
            re.I,
        ),
    ),
    (
        "emergency_triage_request",
        re.compile(
            r"\b(should|do) (i|we|this patient|the patient) (go|send|be sent) (to )?(the )?"
            r"(er|ed|emergency|hospital)|\bam i having an emergency\b|\bchest (pain|hurts|tightness|pressure)\b|"
            r"\bcan't breathe\b|\bstroke\b|\bheart attack\b|\b(left )?arm (numbness|pain)\b",
            re.I,
        ),
    ),
    (
        "ignore_symptom_request",
        re.compile(r"\b(can|should) (i|we|the patient) ignore\b|\bignore (this|the) symptom", re.I),
    ),
    (
        "medication_dose_request",
        re.compile(
            r"\b(what|which|how much|how many)\b.*\b(dose|dosage|mg|milligram|units?)\b|"
            r"\b(dose|dosage) (should|do) (i|we|the patient)",
            re.I,
        ),
    ),
    (
        "prescribing_request",
        re.compile(
            r"\b(prescribe|prescription)\b|\bwhat (drug|medication) should (i|we|the patient) "
            r"(take|start|use)\b|\bstart (me|the patient) on\b",
            re.I,
        ),
    ),
    (
        "diagnosis_request",
        re.compile(
            r"\bdiagnos(e|is|ing)\b|\bdo i have\b|\bam i (hypertensive|diabetic|sick)\b|"
            r"\btell me if (i|the patient) (have|has)\b",
            re.I,
        ),
    ),
]

CALCULATOR_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in [
        r"\bcalculate\b",
        r"\bbmi\b",
        r"\d+(\.\d+)?\s*kg.*\d+(\.\d+)?\s*m\b",
    ]
]

WORKFLOW_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in [
        r"follow[- ]?up",
        r"workflow",
        r"referral",
        r"care gap",
        r"appointment",
        r"patient education",
        r"prior authorization",
        r"quality measure",
        r"care coordinator",
    ]
]

GUIDELINE_PATTERNS = [
    re.compile(pattern, re.I)
    for pattern in [
        r"guideline",
        r"evidence",
        r"citation",
        r"hypertension",
        r"blood pressure",
        r"threshold",
        r"lifestyle",
        r"drug treatment",
        r"medication",
        r"\b(nice|cdc|uspstf|aha|acc|nhs|cms)\b",
        r"\bworld health organization\b",
        r"\bwho\b.*\b(guideline|hypertension|blood pressure|pharmacological treatment)\b",
    ]
]


def classify_query(question: str) -> QueryClassification:
    """Classify a clinical RAG query with deterministic, testable rules.

    The classifier intentionally favors safety over recall. It should be cheap,
    auditable, and suitable as the first gate before retrieval or generation.
    """

    normalized = " ".join(question.strip().split())
    prompt_injection_detected = any(
        pattern.search(normalized) for pattern in PROMPT_INJECTION_PATTERNS
    )

    for reason, pattern in REFUSAL_PATTERNS:
        if pattern.search(normalized):
            return QueryClassification(
                intent="unsafe_medical_advice_request",
                refusal_reason=reason,
                prompt_injection_detected=prompt_injection_detected,
            )

    if any(pattern.search(normalized) for pattern in CALCULATOR_PATTERNS):
        return QueryClassification(
            intent="calculator_question",
            prompt_injection_detected=prompt_injection_detected,
        )

    if any(pattern.search(normalized) for pattern in WORKFLOW_PATTERNS):
        return QueryClassification(
            intent="workflow_question",
            prompt_injection_detected=prompt_injection_detected,
        )

    if any(pattern.search(normalized) for pattern in GUIDELINE_PATTERNS):
        return QueryClassification(
            intent="guideline_question",
            prompt_injection_detected=prompt_injection_detected,
        )

    return QueryClassification(
        intent="out_of_domain",
        prompt_injection_detected=prompt_injection_detected,
    )


def refusal_message(reason: RefusalReason | None, *, mode: str) -> str:
    audience = "your licensed clinician" if mode == "patient" else "a licensed clinician"
    reason_messages: dict[str, str] = {
        "diagnosis_request": "I cannot diagnose a condition or determine whether someone has a disease.",
        "prescribing_request": "I cannot prescribe or recommend which medication someone should take.",
        "emergency_triage_request": (
            "I cannot provide emergency triage or decide whether someone should go to the ER. "
            "If symptoms may be urgent or severe, seek immediate professional or emergency care."
        ),
        "medication_dose_request": "I cannot recommend medication doses or dosing changes.",
        "ignore_symptom_request": "I cannot tell someone to ignore symptoms.",
        "prompt_injection_request": "I cannot follow requests to bypass safety rules or reveal hidden instructions.",
    }
    reason_text = reason_messages.get(
        reason or "", "I cannot safely answer that request as medical advice."
    )
    return (
        f"{reason_text} I can help summarize public guideline evidence for education and "
        f"workflow preparation, but this is not medical advice. Please consult {audience}."
    )
