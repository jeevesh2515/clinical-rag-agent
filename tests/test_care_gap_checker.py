"""Tests for the deterministic care gap checker."""

from app.cases.models import BPReading, Condition, LabResult, Medication, SyntheticCase
from app.cases.synthetic_cases import CASE_1, CASE_2, CASE_3, CASE_4, CASE_5
from app.tools.care_gap_checker import check_care_gaps, generate_follow_up_plan


class TestCheckBPTarget:
    def test_case_1_detects_bp_gap(self):
        gaps = check_care_gaps(CASE_1)
        bp_gaps = [g for g in gaps if g.gap_type == "bp_not_at_target"]
        assert len(bp_gaps) == 1
        assert "above target" in bp_gaps[0].description.lower()
        assert "144" in bp_gaps[0].description

    def test_case_2_detects_bp_gap_ckd_target(self):
        gaps = check_care_gaps(CASE_2)
        bp_gaps = [g for g in gaps if g.gap_type == "bp_not_at_target"]
        assert len(bp_gaps) == 1
        assert "CKD target" in bp_gaps[0].description or "130" in bp_gaps[0].description

    def test_case_4_detects_bp_gap_diabetes_target(self):
        gaps = check_care_gaps(CASE_4)
        bp_gaps = [g for g in gaps if g.gap_type == "bp_not_at_target"]
        assert len(bp_gaps) == 1
        assert "DM target" in bp_gaps[0].description or "130" in bp_gaps[0].description

    def test_case_5_detects_bp_gap_resistant(self):
        gaps = check_care_gaps(CASE_5)
        bp_gaps = [g for g in gaps if g.gap_type == "bp_not_at_target"]
        assert len(bp_gaps) == 1

    def test_no_bp_gap_when_at_target(self):
        case = SyntheticCase(
            case_id="test-controlled",
            age=45,
            sex="M",
            conditions=[Condition(name="Hypertension")],
            medications=[Medication(name="amlodipine", dose="5 mg", class_name="ccb")],
            bp_readings=[BPReading(systolic=125, diastolic=80, date="2026-06-01")],
            lab_results=[],
            last_visit_date="2026-06-01",
        )
        gaps = check_care_gaps(case)
        bp_gaps = [g for g in gaps if g.gap_type == "bp_not_at_target"]
        assert len(bp_gaps) == 0


class TestCheckMissingDrugClass:
    def test_case_1_missing_acei_for_stage1(self):
        gaps = check_care_gaps(CASE_1)
        drug_gaps = [g for g in gaps if g.gap_type == "missing_drug_class"]
        assert len(drug_gaps) == 0  # Not CKD/DM, so no mandatory ACEi/ARB

    def test_case_2_has_acei_ckd(self):
        gaps = check_care_gaps(CASE_2)
        drug_gaps = [g for g in gaps if g.gap_type == "missing_drug_class"]
        # Case 2 has lisinopril (ACEi), so no gap
        assert len(drug_gaps) == 0

    def test_ckd_missing_acei_detected(self):
        case = SyntheticCase(
            case_id="test-ckd-no-acei",
            age=60,
            sex="F",
            conditions=[Condition(name="Hypertension"), Condition(name="CKD Stage 3")],
            medications=[Medication(name="amlodipine", dose="5 mg", class_name="ccb")],
            bp_readings=[BPReading(systolic=140, diastolic=85, date="2026-06-01")],
            lab_results=[],
            last_visit_date="2026-06-01",
        )
        gaps = check_care_gaps(case)
        drug_gaps = [g for g in gaps if g.gap_type == "missing_drug_class"]
        assert len(drug_gaps) == 1
        assert "ACEi/ARB" in drug_gaps[0].description


class TestCheckLabsOverdue:
    def test_labs_not_overdue_if_recent(self):
        case = SyntheticCase(
            case_id="test-recent-labs",
            age=50,
            sex="M",
            conditions=[Condition(name="Hypertension")],
            medications=[],
            bp_readings=[BPReading(systolic=135, diastolic=85, date="2026-06-01")],
            lab_results=[
                LabResult(test="creatinine", value="0.9 mg/dL", date="2026-06-01"),
                LabResult(test="HbA1c", value="5.5%", date="2026-06-01"),
                LabResult(test="lipid panel", value="Normal", date="2026-06-01"),
            ],
            last_visit_date="2026-06-01",
        )
        gaps = check_care_gaps(case)
        lab_gaps = [g for g in gaps if g.gap_type == "labs_overdue"]
        assert len(lab_gaps) == 0

    def test_hba1c_overdue(self):
        case = SyntheticCase(
            case_id="test-old-labs",
            age=55,
            sex="M",
            conditions=[Condition(name="Hypertension"), Condition(name="Type 2 Diabetes")],
            medications=[Medication(name="metformin", dose="1000 mg", class_name="other")],
            bp_readings=[BPReading(systolic=130, diastolic=80, date="2026-06-01")],
            lab_results=[
                LabResult(test="HbA1c", value="8.5%", date="2024-01-15"),
                LabResult(test="creatinine", value="0.9 mg/dL", date="2024-01-15"),
            ],
            last_visit_date="2026-06-01",
        )
        gaps = check_care_gaps(case)
        lab_gaps = [g for g in gaps if g.gap_type == "labs_overdue"]
        assert len(lab_gaps) >= 1


class TestCheckFollowUpOverdue:
    def test_follow_up_not_overdue_if_recent(self):
        case = SyntheticCase(
            case_id="test-recent-visit",
            age=45,
            sex="F",
            conditions=[Condition(name="Hypertension")],
            medications=[],
            bp_readings=[BPReading(systolic=125, diastolic=80, date="2026-06-01")],
            lab_results=[],
            last_visit_date="2026-07-01",
        )
        gaps = check_care_gaps(case)
        fu_gaps = [g for g in gaps if g.gap_type == "follow_up_overdue"]
        assert len(fu_gaps) == 0


class TestCheckScreeningNeeded:
    def test_case_5_detects_resistant_screening(self):
        gaps = check_care_gaps(CASE_5)
        screen_gaps = [g for g in gaps if g.gap_type == "screening_needed"]
        assert len(screen_gaps) >= 1
        assert any("resistant" in g.description.lower() for g in screen_gaps)


class TestAllCases:
    def test_every_case_has_fixture_data(self):
        for case in [CASE_1, CASE_2, CASE_3, CASE_4, CASE_5]:
            assert case.case_id
            assert case.age > 0
            assert case.sex in ("M", "F")
            assert len(case.conditions) > 0
            assert case.last_visit_date

    def test_every_case_produces_summary(self):
        for case in [CASE_1, CASE_2, CASE_3, CASE_4, CASE_5]:
            summary = case.summary()
            assert case.case_id in summary
            assert str(case.age) in summary

    def test_every_case_has_some_gaps_detected(self):
        for case in [CASE_1, CASE_2, CASE_4, CASE_5]:
            gaps = check_care_gaps(case)
            assert len(gaps) >= 1, f"{case.case_id} should have at least one gap"
            for gap in gaps:
                assert gap.gap_type
                assert gap.description
                assert gap.severity in ("high", "medium", "low")

    def test_case_3_may_have_no_gaps(self):
        gaps = check_care_gaps(CASE_3)
        assert isinstance(gaps, list)


class TestFollowUpPlan:
    def test_plan_generated(self):
        for case in [CASE_1, CASE_2, CASE_4, CASE_5]:
            gaps = check_care_gaps(case)
            plan = generate_follow_up_plan(case, gaps)
            assert len(plan) >= 3
            assert any("BP" in step for step in plan)

    def test_pregnancy_plan_includes_obstetrics(self):
        gaps = check_care_gaps(CASE_3)
        plan = generate_follow_up_plan(CASE_3, gaps)
        assert any("obstetrics" in step.lower() for step in plan)

    def test_diabetes_plan_includes_glycemic(self):
        gaps = check_care_gaps(CASE_4)
        plan = generate_follow_up_plan(CASE_4, gaps)
        assert any("glycemic" in step.lower() or "diabetes" in step.lower() for step in plan)
