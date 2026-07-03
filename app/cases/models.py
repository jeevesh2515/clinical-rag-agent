from pydantic import BaseModel, Field


class BPReading(BaseModel):
    systolic: int = Field(description="Systolic blood pressure in mmHg")
    diastolic: int = Field(description="Diastolic blood pressure in mmHg")
    date: str = Field(description="Date of reading in YYYY-MM-DD format")


class Medication(BaseModel):
    name: str = Field(description="Medication name")
    dose: str = Field(description="Dose and frequency")
    class_name: str = Field(
        default="",
        description="Drug class: acei, arb, ccb, thiazide, loop_diuretic, mra, beta_blocker, alpha_blocker, centrally_acting, other",
    )


class LabResult(BaseModel):
    test: str = Field(description="Lab test name (e.g. creatinine, eGFR, HbA1c)")
    value: str = Field(description="Result value with units")
    date: str = Field(description="Date of result in YYYY-MM-DD format")


class Condition(BaseModel):
    name: str = Field(description="Condition name (e.g. Hypertension, CKD, Diabetes)")
    status: str = Field(default="active", description="Condition status")


class CareGap(BaseModel):
    gap_type: str = Field(
        description="Gap type: bp_not_at_target, missing_drug_class, labs_overdue, follow_up_overdue, screening_needed"
    )
    description: str = Field(description="Human-readable description of the care gap")
    severity: str = Field(default="medium", description="Severity: high, medium, low")
    recommendation: str = Field(default="", description="Suggested action to close the gap")


class SyntheticCase(BaseModel):
    case_id: str = Field(description="Unique case identifier")
    age: int = Field(description="Patient age")
    sex: str = Field(description="Sex (M, F)")
    conditions: list[Condition] = Field(default_factory=list)
    medications: list[Medication] = Field(default_factory=list)
    bp_readings: list[BPReading] = Field(default_factory=list)
    lab_results: list[LabResult] = Field(default_factory=list)
    last_visit_date: str = Field(description="Date of last visit in YYYY-MM-DD format")
    care_gaps: list[CareGap] = Field(default_factory=list, description="Computed care gaps")

    def summary(self) -> str:
        parts = [
            f"Case {self.case_id}: {self.age}{self.sex}",
        ]
        if self.conditions:
            parts.append(f"Conditions: {', '.join(c.name for c in self.conditions)}")
        if self.medications:
            parts.append(f"Meds: {', '.join(f'{m.name} {m.dose}' for m in self.medications)}")
        if self.bp_readings:
            latest = max(self.bp_readings, key=lambda r: r.date)
            parts.append(f"Latest BP: {latest.systolic}/{latest.diastolic}")
        if self.lab_results:
            latest_labs = sorted(self.lab_results, key=lambda r: r.date, reverse=True)
            lab_str = "; ".join(f"{r.test}: {r.value}" for r in latest_labs[:5])
            parts.append(f"Labs: {lab_str}")
        parts.append(f"Last visit: {self.last_visit_date}")
        return " | ".join(parts)
