"""Deterministic care gap checker for hypertension management.

Every canonical rule threshold must be traceable to an OKF concept file.
Runs zero ML — all rules are hardcoded clinical logic with unit tests.
"""

from datetime import date, datetime

from app.cases.models import BPReading, CareGap, LabResult, SyntheticCase

# ---------------------------------------------------------------------------
# Guideline BP targets (from OKF: comorbidities/htn-and-ckd, htn-and-diabetes,
# diagnoses/diagnostic-thresholds, guidelines/*)
# ---------------------------------------------------------------------------
BP_TARGET_GENERAL_SYSTOLIC: int = 140
BP_TARGET_GENERAL_DIASTOLIC: int = 90
BP_TARGET_CKD_SYSTOLIC: int = 130
BP_TARGET_CKD_DIASTOLIC: int = 80
BP_TARGET_DIABETES_SYSTOLIC: int = 130
BP_TARGET_DIABETES_DIASTOLIC: int = 80

# Months thresholds
MONTHS_OVERDUE_LABS: int = 12
MONTHS_OVERDUE_FOLLOWUP_CONTROLLED: int = 6
MONTHS_OVERDUE_FOLLOWUP_UNCONTROLLED: int = 3


def _has_condition(case: SyntheticCase, keyword: str) -> bool:
    return any(keyword.lower() in cond.name.lower() for cond in case.conditions)


def _has_drug_class(case: SyntheticCase, class_name: str) -> bool:
    return any(med.class_name.lower() == class_name.lower() for med in case.medications)


def _latest_bp(case: SyntheticCase) -> BPReading | None:
    if not case.bp_readings:
        return None
    return max(case.bp_readings, key=lambda r: r.date)


def _latest_lab(case: SyntheticCase, test_keyword: str) -> LabResult | None:
    matches = [r for r in case.lab_results if test_keyword.lower() in r.test.lower()]
    if not matches:
        return None
    return max(matches, key=lambda r: r.date)


def _months_since(date_str: str) -> int | None:
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    today = date.today()
    return (today.year - d.year) * 12 + (today.month - d.month)


def _determine_bp_target(case: SyntheticCase) -> tuple[int, int]:
    if _has_condition(case, "CKD"):
        return BP_TARGET_CKD_SYSTOLIC, BP_TARGET_CKD_DIASTOLIC
    if _has_condition(case, "Diabetes"):
        return BP_TARGET_DIABETES_SYSTOLIC, BP_TARGET_DIABETES_DIASTOLIC
    return BP_TARGET_GENERAL_SYSTOLIC, BP_TARGET_GENERAL_DIASTOLIC


# ---------------------------------------------------------------------------
# Rule 1: BP Not at Target
# ---------------------------------------------------------------------------
def _check_bp_target(case: SyntheticCase) -> CareGap | None:
    bp = _latest_bp(case)
    if bp is None:
        return None
    target_sys, target_dia = _determine_bp_target(case)

    if bp.systolic > target_sys or bp.diastolic > target_dia:
        cond_label = ""
        if _has_condition(case, "CKD"):
            cond_label = " (CKD target <130/80)"
        elif _has_condition(case, "Diabetes"):
            cond_label = " (DM target <130/80)"
        return CareGap(
            gap_type="bp_not_at_target",
            description=(
                f"BP {bp.systolic}/{bp.diastolic} is above target{cond_label}. "
                f"Target: <{target_sys}/{target_dia}."
            ),
            severity="high",
            recommendation=(
                "Consider medication adjustment or intensification. "
                "Recheck in 2-4 weeks per follow-up cadence guidelines."
            ),
        )
    return None


# ---------------------------------------------------------------------------
# Rule 2: Missing Recommended Drug Class
# ---------------------------------------------------------------------------
def _check_missing_drug_class(case: SyntheticCase) -> CareGap | None:
    """Check if ACEi/ARB is missing for CKD or Diabetes with albuminuria."""
    if _has_condition(case, "CKD") and not _has_drug_class(case, "acei") and not _has_drug_class(case, "arb"):
        return CareGap(
            gap_type="missing_drug_class",
            description="ACEi/ARB is recommended as first-line in CKD with albuminuria.",
            severity="high",
            recommendation="Consider starting ACEi or ARB for renoprotective benefit. Monitor creatinine and potassium 1-2 weeks after initiation.",
        )
    if (
        _has_condition(case, "Diabetes")
        and not _has_drug_class(case, "acei")
        and not _has_drug_class(case, "arb")
    ):
        return CareGap(
            gap_type="missing_drug_class",
            description="ACEi/ARB is preferred first-line in hypertension with diabetes.",
            severity="high",
            recommendation="Consider starting ACEi or ARB for cardiovascular and renal protection.",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 3: Labs Overdue
# ---------------------------------------------------------------------------
def _check_labs_overdue(case: SyntheticCase) -> list[CareGap]:
    """Check if annual labs are overdue based on OKF lab-schedule thresholds."""
    gaps: list[CareGap] = []
    if not case.lab_results:
        return gaps

    for test_keyword, test_label in [
        ("creatinine", "Creatinine / eGFR"),
        ("HbA1c", "HbA1c"),
        ("lipid", "Lipid panel"),
    ]:
        lab = _latest_lab(case, test_keyword)
        if lab and _months_since(lab.date) is not None and _months_since(lab.date) > MONTHS_OVERDUE_LABS:
            gaps.append(
                CareGap(
                    gap_type="labs_overdue",
                    description=f"{test_label} last checked {lab.date} — over {MONTHS_OVERDUE_LABS} months ago.",
                    severity="medium",
                    recommendation=f"Order {test_label} to update baseline. Annual monitoring is recommended per lab schedule guidelines.",
                )
            )

    if _has_condition(case, "Diabetes"):
        hba1c = _latest_lab(case, "HbA1c")
        if hba1c:
            try:
                value = float(hba1c.value.replace("%", "").strip())
            except (ValueError, AttributeError):
                value = 0
            if value > 7.0:
                gaps.append(
                    CareGap(
                        gap_type="labs_overdue",
                        description=f"HbA1c is {value}% — above the general diabetes target of ≤7.0%.",
                        severity="high",
                        recommendation="Consider intensifying diabetes management. Recheck HbA1c in 3 months.",
                    )
                )

    return gaps


# ---------------------------------------------------------------------------
# Rule 4: Follow-up Overdue
# ---------------------------------------------------------------------------
def _check_follow_up_overdue(case: SyntheticCase) -> CareGap | None:
    bp = _latest_bp(case)
    months = _months_since(case.last_visit_date)
    if months is None:
        return None

    target_sys, target_dia = _determine_bp_target(case)
    is_controlled = bp is not None and bp.systolic <= target_sys and bp.diastolic <= target_dia
    overdue_threshold = MONTHS_OVERDUE_FOLLOWUP_CONTROLLED if is_controlled else MONTHS_OVERDUE_FOLLOWUP_UNCONTROLLED

    if months > overdue_threshold:
        status = "controlled" if is_controlled else "above target"
        return CareGap(
            gap_type="follow_up_overdue",
            description=f"Last visit was {case.last_visit_date} ({months} months ago). BP is {status}. "
            f"Recommended follow-up is every {overdue_threshold} months.",
            severity="medium",
            recommendation="Schedule follow-up visit. Include BP measurement, medication review, and lab monitoring as indicated.",
        )
    return None


# ---------------------------------------------------------------------------
# Rule 5: Screening Needed
# ---------------------------------------------------------------------------
def _check_screening_needed(case: SyntheticCase) -> CareGap | None:
    num_agents = len(
        [m for m in case.medications if m.class_name not in ("other", "")]
    )
    bp = _latest_bp(case)

    if num_agents >= 3 and bp and (bp.systolic > 140 or bp.diastolic > 90):
        return CareGap(
            gap_type="screening_needed",
            description="Patient has resistant HTN (BP above goal on ≥3 agents). "
            "Resistant HTN workup should be considered.",
            severity="high",
            recommendation="Screen for secondary causes: aldosterone:renin ratio, renal imaging, "
            "polysomnography for OSA. Consider MRA (spironolactone) as 4th-line agent. "
            "Refer to Resistant HTN Workup protocol.",
        )

    if _has_condition(case, "OSA") or _has_condition(case, "Obstructive Sleep Apnea"):
        return CareGap(
            gap_type="screening_needed",
            description="Suspected obstructive sleep apnea — untreated OSA can worsen BP control.",
            severity="medium",
            recommendation="Consider formal polysomnography referral if not already done. "
            "CPAP therapy may improve nocturnal BP control.",
        )

    return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def check_care_gaps(case: SyntheticCase) -> list[CareGap]:
    """Run all deterministic care gap rules and return detected gaps."""
    gaps: list[CareGap] = []

    bp_gap = _check_bp_target(case)
    if bp_gap:
        gaps.append(bp_gap)

    drug_gap = _check_missing_drug_class(case)
    if drug_gap:
        gaps.append(drug_gap)

    gaps.extend(_check_labs_overdue(case))

    fu_gap = _check_follow_up_overdue(case)
    if fu_gap:
        gaps.append(fu_gap)

    screen_gap = _check_screening_needed(case)
    if screen_gap:
        gaps.append(screen_gap)

    return gaps


def generate_follow_up_plan(case: SyntheticCase, gaps: list[CareGap]) -> list[str]:
    """Generate follow-up plan steps from detected care gaps."""
    plan: list[str] = []

    bp = _latest_bp(case)
    if bp:
        target_sys, target_dia = _determine_bp_target(case)
        plan.append(f"Review BP control: current {bp.systolic}/{bp.diastolic}, target <{target_sys}/{target_dia}.")

    plan.append("Medication reconciliation — verify adherence and tolerability.")
    plan.append("Review recent lab results (creatinine, eGFR, K+, HbA1c, lipids).")

    if gaps:
        plan.append("Address the following care gaps:")
        for gap in gaps:
            if gap.recommendation:
                plan.append(f"  - {gap.recommendation}")

    if _has_condition(case, "Pregnancy"):
        plan.append("Coordinate with obstetrics for BP monitoring during pregnancy.")
    if _has_condition(case, "Diabetes"):
        plan.append("Review glycemic control and diabetes management plan.")
    if _has_condition(case, "CKD"):
        plan.append("Review CKD stage and renoprotective therapy adequacy.")

    plan.append("Schedule follow-up as per guideline-recommended cadence.")
    plan.append("Document plan and share with patient after clinician review.")

    return plan
