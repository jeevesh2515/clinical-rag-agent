"""Smoke-test all four clinical_rag_mcp tools without the MCP Inspector.

Usage:
    python3 test_tools.py
    CLINICAL_RAG_API_URL=https://clinical-workflows.vercel.app python3 test_tools.py
"""
import asyncio
import json

import server


async def main() -> None:
    bmi = await server.clinical_calculate_bmi(weight_kg=70, height_m=1.75)
    mean_arterial_pressure = await server.clinical_calculate_map(systolic_mmhg=120, diastolic_mmhg=80)
    pulse_pressure = await server.clinical_calculate_pulse_pressure(systolic_mmhg=120, diastolic_mmhg=80)
    assert json.loads(bmi) == {"bmi": 22.9, "category": "Normal weight"}
    assert json.loads(mean_arterial_pressure) == {"map_mmhg": 93.3}
    assert json.loads(pulse_pressure) == {"pulse_pressure_mmhg": 40}
    assert "error" in json.loads(await server.clinical_calculate_map(20, 10))
    print("calculator contract: passed")
    print("evidence:", await server.clinical_query_evidence(
        question="When should drug treatment be considered for stage 1 hypertension?"))


if __name__ == "__main__":
    asyncio.run(main())
