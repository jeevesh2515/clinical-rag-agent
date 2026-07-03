"""Synthetic patient case fixtures for hypertension care gap demo.

Each case represents a realistic hypertension patient with conditions,
medications, BP readings, and lab results. No real PII is used.
"""

from app.cases.models import BPReading, Condition, LabResult, Medication, SyntheticCase

# ---------------------------------------------------------------------------
# Case 1: Stage 1 HTN on CCB — not at target, missing ACEi/ARB
# ---------------------------------------------------------------------------
CASE_1 = SyntheticCase(
    case_id="htn-001",
    age=55,
    sex="M",
    conditions=[Condition(name="Hypertension (Stage 1)")],
    medications=[
        Medication(name="amlodipine", dose="5 mg daily", class_name="ccb"),
    ],
    bp_readings=[
        BPReading(systolic=148, diastolic=90, date="2026-04-10"),
        BPReading(systolic=142, diastolic=88, date="2026-05-15"),
        BPReading(systolic=144, diastolic=86, date="2026-06-20"),
    ],
    lab_results=[
        LabResult(test="creatinine", value="0.9 mg/dL", date="2026-01-10"),
        LabResult(test="eGFR", value="92 mL/min/1.73m²", date="2026-01-10"),
        LabResult(test="HbA1c", value="5.4%", date="2026-01-10"),
        LabResult(test="potassium", value="4.1 mmol/L", date="2026-01-10"),
        LabResult(test="lipid panel", value="TC 190, LDL 110, HDL 45, TG 150 mg/dL", date="2026-01-10"),
    ],
    last_visit_date="2026-06-20",
)

# ---------------------------------------------------------------------------
# Case 2: HTN + CKD on ACEi — BP above CKD target, follow-up overdue
# ---------------------------------------------------------------------------
CASE_2 = SyntheticCase(
    case_id="htn-002",
    age=68,
    sex="F",
    conditions=[
        Condition(name="Hypertension"),
        Condition(name="CKD Stage 3a"),
    ],
    medications=[
        Medication(name="lisinopril", dose="20 mg daily", class_name="acei"),
    ],
    bp_readings=[
        BPReading(systolic=155, diastolic=92, date="2026-02-10"),
        BPReading(systolic=150, diastolic=90, date="2026-03-05"),
        BPReading(systolic=152, diastolic=88, date="2026-06-22"),
    ],
    lab_results=[
        LabResult(test="creatinine", value="1.4 mg/dL", date="2026-03-05"),
        LabResult(test="eGFR", value="45 mL/min/1.73m²", date="2026-03-05"),
        LabResult(test="potassium", value="4.6 mmol/L", date="2026-03-05"),
        LabResult(test="ACR", value="85 mg/g", date="2026-03-05"),
    ],
    last_visit_date="2026-06-22",
)

# ---------------------------------------------------------------------------
# Case 3: HTN + Pregnancy on labetalol — needs closer monitoring
# ---------------------------------------------------------------------------
CASE_3 = SyntheticCase(
    case_id="htn-003",
    age=32,
    sex="F",
    conditions=[
        Condition(name="Hypertension"),
        Condition(name="Pregnancy (28 weeks)"),
    ],
    medications=[
        Medication(name="labetalol", dose="200 mg twice daily", class_name="beta_blocker"),
    ],
    bp_readings=[
        BPReading(systolic=138, diastolic=88, date="2026-05-01"),
        BPReading(systolic=135, diastolic=85, date="2026-06-01"),
        BPReading(systolic=136, diastolic=84, date="2026-07-01"),
    ],
    lab_results=[
        LabResult(test="creatinine", value="0.7 mg/dL", date="2026-06-01"),
        LabResult(test="eGFR", value="105 mL/min/1.73m²", date="2026-06-01"),
        LabResult(test="urinalysis", value="No proteinuria", date="2026-06-01"),
    ],
    last_visit_date="2026-07-01",
)

# ---------------------------------------------------------------------------
# Case 4: HTN + Diabetes on metformin + lisinopril — BP not at DM target, A1c high
# ---------------------------------------------------------------------------
CASE_4 = SyntheticCase(
    case_id="htn-004",
    age=72,
    sex="M",
    conditions=[
        Condition(name="Hypertension"),
        Condition(name="Type 2 Diabetes"),
    ],
    medications=[
        Medication(name="metformin", dose="1000 mg twice daily", class_name="other"),
        Medication(name="lisinopril", dose="10 mg daily", class_name="acei"),
        Medication(name="atorvastatin", dose="20 mg daily", class_name="other"),
    ],
    bp_readings=[
        BPReading(systolic=142, diastolic=88, date="2026-04-05"),
        BPReading(systolic=138, diastolic=86, date="2026-05-10"),
        BPReading(systolic=140, diastolic=84, date="2026-06-15"),
    ],
    lab_results=[
        LabResult(test="creatinine", value="1.1 mg/dL", date="2026-04-05"),
        LabResult(test="eGFR", value="65 mL/min/1.73m²", date="2026-04-05"),
        LabResult(test="HbA1c", value="8.2%", date="2026-06-15"),
        LabResult(test="lipid panel", value="TC 170, LDL 85, HDL 40, TG 160 mg/dL", date="2026-04-05"),
    ],
    last_visit_date="2026-06-15",
)

# ---------------------------------------------------------------------------
# Case 5: Resistant HTN on 3 agents — BP above goal
# ---------------------------------------------------------------------------
CASE_5 = SyntheticCase(
    case_id="htn-005",
    age=48,
    sex="M",
    conditions=[
        Condition(name="Resistant Hypertension"),
        Condition(name="Obstructive Sleep Apnea (suspected)"),
    ],
    medications=[
        Medication(name="amlodipine", dose="10 mg daily", class_name="ccb"),
        Medication(name="losartan", dose="100 mg daily", class_name="arb"),
        Medication(name="chlorthalidone", dose="25 mg daily", class_name="thiazide"),
    ],
    bp_readings=[
        BPReading(systolic=156, diastolic=96, date="2026-03-10"),
        BPReading(systolic=152, diastolic=94, date="2026-04-12"),
        BPReading(systolic=154, diastolic=92, date="2026-05-08"),
    ],
    lab_results=[
        LabResult(test="creatinine", value="1.0 mg/dL", date="2026-05-08"),
        LabResult(test="eGFR", value="88 mL/min/1.73m²", date="2026-05-08"),
        LabResult(test="potassium", value="4.0 mmol/L", date="2026-05-08"),
        LabResult(test="Aldosterone:Renin Ratio", value="Pending", date="2026-05-08"),
        LabResult(test="STOP-BANG", value="Score 5 (high risk OSA)", date="2026-05-08"),
    ],
    last_visit_date="2026-05-08",
)

SYNTHETIC_CASES: dict[str, SyntheticCase] = {
    c.case_id: c for c in [CASE_1, CASE_2, CASE_3, CASE_4, CASE_5]
}


def list_cases() -> list[dict]:
    return [
        {
            "case_id": c.case_id,
            "age": c.age,
            "sex": c.sex,
            "summary": c.summary(),
            "conditions": [cond.name for cond in c.conditions],
        }
        for c in SYNTHETIC_CASES.values()
    ]
