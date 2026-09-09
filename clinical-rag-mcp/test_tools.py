"""Smoke-test all four clinical_rag_mcp tools without the MCP Inspector.

Usage:
    python3 test_tools.py
    CLINICAL_RAG_API_URL=https://clinical-workflows.vercel.app python3 test_tools.py
"""
import asyncio

import server


async def main() -> None:
    print("bmi:", await server.clinical_calculate_bmi(weight_kg=70, height_m=1.75))
    print("map:", await server.clinical_calculate_map(systolic_mmhg=120, diastolic_mmhg=80))
    print("pulse:", await server.clinical_calculate_pulse_pressure(systolic_mmhg=120, diastolic_mmhg=80))
    print("evidence:", await server.clinical_query_evidence(
        question="When should drug treatment be considered for stage 1 hypertension?"))


if __name__ == "__main__":
    asyncio.run(main())
