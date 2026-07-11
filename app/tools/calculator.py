import re

_MIN_KG = 1.0
_MAX_KG = 500.0
_MIN_M = 0.3
_MAX_M = 2.5
_MIN_BP = 30
_MAX_BP = 350
_MIN_AGE = 1
_MAX_AGE = 130
_MIN_CREAT = 5
_MAX_CREAT = 2000


def _try_float(value: str, min_v: float, max_v: float) -> float | None:
    try:
        v = float(value)
    except ValueError:
        return None
    if v < min_v or v > max_v:
        return None
    return v


def calculate_bmi(question: str) -> str | None:
    kg_m = re.search(r"(\d+(?:\.\d+)?)\s*kg", question, flags=re.I)
    metres_m = re.search(r"(\d+(?:\.\d+)?)\s*m(?:etre|eter)?s?\b", question, flags=re.I)
    if not kg_m or not metres_m:
        return None
    weight = _try_float(kg_m.group(1), _MIN_KG, _MAX_KG)
    height = _try_float(metres_m.group(1), _MIN_M, _MAX_M)
    if weight is None or height is None:
        return None
    bmi = weight / (height * height)
    return f"BMI = {bmi:.1f} kg/m²"


def calculate_map(question: str) -> str | None:
    bp_pair = re.search(r"(?:bp|blood\s*pressure)?\s*(\d+)\s*(?:/|over)\s*(\d+)", question, flags=re.I)
    if not bp_pair:
        return None
    sys_val = _try_float(bp_pair.group(1), _MIN_BP, _MAX_BP)
    dia_val = _try_float(bp_pair.group(2), _MIN_BP, _MAX_BP)
    if sys_val is None or dia_val is None:
        return None
    map_v = dia_val + (sys_val - dia_val) / 3.0
    return f"MAP = {map_v:.0f} mmHg"


def calculate_pulse_pressure(question: str) -> str | None:
    bp_pair = re.search(r"(?:bp|blood\s*pressure)?\s*(\d+)\s*(?:/|over)\s*(\d+)", question, flags=re.I)
    if not bp_pair:
        return None
    sys_val = _try_float(bp_pair.group(1), _MIN_BP, _MAX_BP)
    dia_val = _try_float(bp_pair.group(2), _MIN_BP, _MAX_BP)
    if sys_val is None or dia_val is None:
        return None
    pp = sys_val - dia_val
    return f"Pulse Pressure = {pp:.0f} mmHg"


def _ckd_epi(scr: float, age: float, female: bool) -> float:
    """Compute eGFR using the CKD-EPI 2009 formula.

    scr must be in mg/dL.
    """
    if female:
        kappa = 0.7
        alpha = -0.329
        sex_factor = 1.018
    else:
        kappa = 0.9
        alpha = -0.411
        sex_factor = 1.0

    ratio = scr / kappa
    if ratio <= 1:
        egfr = 141 * (ratio ** alpha) * (0.993 ** age) * sex_factor
    else:
        egfr = 141 * (ratio ** -1.209) * (0.993 ** age) * sex_factor
    return round(egfr, 1)


def calculate_egfr(question: str) -> str | None:
    creat_m = re.search(
        r"(\d+(?:\.\d+)?)\s*(mg/dL|mg/dl|umol/L|umol/l|µmol/L)",
        question,
        flags=re.I,
    )
    if not creat_m:
        return None
    raw = float(creat_m.group(1))
    unit = creat_m.group(2)
    # Convert to mg/dL if needed
    if "mg" in unit:
        if raw < 0.2 or raw > 50:
            return None
        scr_mgdl = raw
    else:
        if raw < 18 or raw > 4420:
            return None
        scr_mgdl = raw / 88.42  # Convert µmol/L to mg/dL

    age_m = re.search(r"(\d+)\s*[-]?\s*(?:years?|yrs?|yo|year[ -]old)", question, flags=re.I)
    age_val = _try_float(age_m.group(1), _MIN_AGE, _MAX_AGE) if age_m else None
    if age_val is None:
        return None  # eGFR requires age
    is_female = bool(re.search(r"\bfemale\b|\bwoman\b|\b[Ff]\b", question, flags=re.I))

    egfr = _ckd_epi(scr_mgdl, age_val, is_female)
    return f"eGFR (CKD-EPI) = {egfr:.0f} mL/min/1.73m²"
