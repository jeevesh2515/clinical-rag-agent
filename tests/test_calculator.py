from app.tools.calculator import (
    calculate_bmi,
    calculate_egfr,
    calculate_map,
    calculate_pulse_pressure,
)


def test_bmi_happy_path():
    result = calculate_bmi("Patient weighs 80 kg and is 1.75 m tall")
    assert result is not None
    assert "26.1" in result


def test_bmi_out_of_range_weight_rejected():
    result = calculate_bmi("Patient weighs 600 kg and is 1.75 m tall")
    assert result is None


def test_bmi_out_of_range_height_rejected():
    result = calculate_bmi("Patient weighs 80 kg and is 0.1 m tall")
    assert result is None


def test_bmi_no_match_returns_none():
    result = calculate_bmi("What is the patient's cardiovascular risk?")
    assert result is None


def test_bmi_metres_variant():
    result = calculate_bmi("80 kg, 1.75 meters")
    assert result is not None
    assert "26.1" in result


def test_map_from_bp_pair():
    result = calculate_map("BP 120/80")
    assert result is not None
    assert "MAP = 93" in result


def test_map_from_blood_pressure_phrase():
    result = calculate_map("blood pressure 140/90")
    assert result is not None
    assert "MAP = 107" in result


def test_map_over_notation():
    result = calculate_map("BP 120 over 80")
    assert result is not None
    assert "MAP = 93" in result


def test_map_out_of_range_rejected():
    result = calculate_map("BP 10/5")
    assert result is None


def test_map_no_match_returns_none():
    result = calculate_map("What is the MAP?")
    assert result is None


def test_pulse_pressure_from_bp_pair():
    result = calculate_pulse_pressure("BP 120/80")
    assert result is not None
    assert "Pulse Pressure = 40" in result


def test_pulse_pressure_wide():
    result = calculate_pulse_pressure("BP 160/60")
    assert result is not None
    assert "Pulse Pressure = 100" in result


def test_pulse_pressure_no_match():
    result = calculate_pulse_pressure("What is the pulse pressure?")
    assert result is None


def test_egfr_with_age_and_sex():
    result = calculate_egfr("Creatinine 88.4 umol/L, 65 years old male")
    assert result is not None
    assert "Creatinine" in result


def test_egfr_mgdl():
    result = calculate_egfr("Cr 1.0 mg/dL, 50yo female")
    assert result is not None
    assert "Female" in result


def test_egfr_no_match_returns_none():
    result = calculate_egfr("What is the renal function?")
    assert result is None


def test_egfr_out_of_range_rejected():
    result = calculate_egfr("Creatinine 10000 umol/L, 40 years old male")
    assert result is None
