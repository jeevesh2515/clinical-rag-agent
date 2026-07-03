"""Tests for the cases module — models, repository, and synthetic fixtures."""

from app.cases.models import BPReading, CareGap, Condition, LabResult, Medication, SyntheticCase
from app.cases.repository import CaseRepository
from app.cases.synthetic_cases import SYNTHETIC_CASES, list_cases


class TestSyntheticCaseModel:
    def test_bp_reading_creation(self):
        bp = BPReading(systolic=140, diastolic=90, date="2026-06-01")
        assert bp.systolic == 140
        assert bp.diastolic == 90

    def test_medication_creation(self):
        med = Medication(name="amlodipine", dose="5 mg daily", class_name="ccb")
        assert med.class_name == "ccb"

    def test_lab_result_creation(self):
        lab = LabResult(test="creatinine", value="0.9 mg/dL", date="2026-06-01")
        assert lab.test == "creatinine"

    def test_condition_creation(self):
        cond = Condition(name="Hypertension")
        assert cond.status == "active"

    def test_care_gap_creation(self):
        gap = CareGap(
            gap_type="bp_not_at_target",
            description="BP above target",
            severity="high",
            recommendation="Intensify treatment",
        )
        assert gap.gap_type == "bp_not_at_target"
        assert gap.severity == "high"

    def test_synthetic_case_summary_includes_id(self):
        case = SyntheticCase(
            case_id="test-001",
            age=45,
            sex="M",
            conditions=[Condition(name="Hypertension")],
            medications=[Medication(name="amlodipine", dose="5 mg", class_name="ccb")],
            bp_readings=[BPReading(systolic=140, diastolic=90, date="2026-06-01")],
            lab_results=[LabResult(test="creatinine", value="0.9 mg/dL", date="2026-06-01")],
            last_visit_date="2026-06-01",
        )
        summary = case.summary()
        assert "test-001" in summary
        assert "45M" in summary
        assert "Hypertension" in summary
        assert "140/90" in summary

    def test_synthetic_case_empty_lists(self):
        case = SyntheticCase(
            case_id="test-minimal",
            age=30,
            sex="F",
            last_visit_date="2026-06-01",
        )
        assert case.conditions == []
        assert case.medications == []
        assert case.bp_readings == []


class TestCaseRepository:
    def test_load_valid_case(self):
        case = CaseRepository.load("htn-001")
        assert case is not None
        assert case.case_id == "htn-001"
        assert case.age == 55

    def test_load_invalid_case_returns_none(self):
        case = CaseRepository.load("nonexistent")
        assert case is None

    def test_load_all_cases(self):
        for case_id in ["htn-001", "htn-002", "htn-003", "htn-004", "htn-005"]:
            case = CaseRepository.load(case_id)
            assert case is not None, f"Case {case_id} should exist"

    def test_load_case_htn002_has_ckd(self):
        case = CaseRepository.load("htn-002")
        assert case is not None
        assert any("CKD" in c.name for c in case.conditions)

    def test_load_case_htn003_is_pregnant(self):
        case = CaseRepository.load("htn-003")
        assert case is not None
        assert any("Pregnancy" in c.name for c in case.conditions)

    def test_list_available(self):
        ids = CaseRepository.list_available()
        assert len(ids) == 5
        assert "htn-001" in ids

    def test_list_cases_api_format(self):
        cases = list_cases()
        assert len(cases) == 5
        for c in cases:
            assert "case_id" in c
            assert "age" in c
            assert "sex" in c
            assert "summary" in c
            assert "conditions" in c


class TestSyntheticFixtures:
    def test_all_fixtures_have_unique_ids(self):
        ids = [c.case_id for c in SYNTHETIC_CASES.values()]
        assert len(ids) == len(set(ids))

    def test_all_fixtures_have_bp_readings(self):
        for case in SYNTHETIC_CASES.values():
            assert len(case.bp_readings) >= 1, f"{case.case_id} needs BP readings"

    def test_all_fixtures_have_lab_results(self):
        for case in SYNTHETIC_CASES.values():
            assert len(case.lab_results) >= 1, f"{case.case_id} needs lab results"

    def test_all_fixtures_have_medications(self):
        for case in SYNTHETIC_CASES.values():
            assert len(case.medications) >= 1, f"{case.case_id} needs medications"

    def test_case5_has_three_agents(self):
        case = SYNTHETIC_CASES["htn-005"]
        non_other = [m for m in case.medications if m.class_name not in ("other", "")]
        assert len(non_other) >= 3
