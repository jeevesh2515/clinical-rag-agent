# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "mcp>=2.0",
#     "httpx>=0.27",
# ]
# ///
"""
clinical_rag_mcp - Model Context Protocol (MCP) server exposing clinical
calculators and the live Clinical Evidence RAG Agent to Claude Desktop & Claude Code.

Zero-install run directly from GitHub via uv:
    uv run https://raw.githubusercontent.com/jeevesh2515/clinical-rag-agent/main/clinical-rag-mcp/server.py
"""

import os
import json

import httpx

try:  # mcp 2.x: FastMCP renamed to MCPServer
    from mcp.server.mcpserver import MCPServer
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as MCPServer
from mcp.types import ToolAnnotations

# ---------------------------------------------------------------------------
# Server setup
# ---------------------------------------------------------------------------

mcp = MCPServer("clinical_rag_mcp")

_MIN_KG, _MAX_KG = 1.0, 500.0
_MIN_M, _MAX_M = 0.3, 2.5
_MIN_BP, _MAX_BP = 30.0, 350.0


def _annotations(title, *, read_only=True, destructive=False, idempotent=True,
                 open_world=False):
    """ToolAnnotations with field names matching the installed SDK major.

    mcp 1.x uses camelCase (readOnlyHint); mcp 2.x uses snake_case.
    """
    fields = ToolAnnotations.model_fields
    pick = lambda camel, snake: camel if camel in fields else snake  # noqa: E731
    return ToolAnnotations(
        **{
            "title": title,
            pick("readOnlyHint", "read_only_hint"): read_only,
            pick("destructiveHint", "destructive_hint"): destructive,
            pick("idempotentHint", "idempotent_hint"): idempotent,
            pick("openWorldHint", "open_world_hint"): open_world,
        }
    )

# Fill this in with your actual deployed API base URL (the FastAPI backend
# behind clinical-workflows.vercel.app, not the frontend URL itself).
CLINICAL_RAG_API_URL = os.environ.get(
    "CLINICAL_RAG_API_URL", "https://clinical-workflows.vercel.app"
)



# ---------------------------------------------------------------------------
# Day 1: Standalone clinical calculators (no network dependency)
# ---------------------------------------------------------------------------


@mcp.tool(
    name="clinical_calculate_bmi",
    annotations=_annotations("Calculate BMI"),
)
async def clinical_calculate_bmi(weight_kg: float, height_m: float) -> str:
    """Calculate Body Mass Index (BMI) and its standard WHO category.

    Args:
        weight_kg: Body weight in kilograms (e.g. 70.0)
        height_m: Height in metres (e.g. 1.75)

    Returns:
        str: JSON with 'bmi' (float, 1dp) and 'category' (str)
    """
    if not (_MIN_KG <= weight_kg <= _MAX_KG and _MIN_M <= height_m <= _MAX_M):
        return json.dumps({"error": "weight_kg must be 1-500 and height_m must be 0.3-2.5"})
    bmi = round(weight_kg / (height_m ** 2), 1)
    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"
    return f'{{"bmi": {bmi}, "category": "{category}"}}'


def _valid_blood_pressure(systolic_mmhg: float, diastolic_mmhg: float) -> bool:
    return (
        _MIN_BP <= systolic_mmhg <= _MAX_BP
        and _MIN_BP <= diastolic_mmhg <= _MAX_BP
        and systolic_mmhg >= diastolic_mmhg
    )


@mcp.tool(
    name="clinical_calculate_map",
    annotations=_annotations("Calculate Mean Arterial Pressure"),
)
async def clinical_calculate_map(systolic_mmhg: float, diastolic_mmhg: float) -> str:
    """Calculate Mean Arterial Pressure (MAP) from systolic/diastolic BP.

    MAP = DBP + 1/3 (SBP - DBP)

    Args:
        systolic_mmhg: Systolic blood pressure in mmHg (e.g. 120)
        diastolic_mmhg: Diastolic blood pressure in mmHg (e.g. 80)

    Returns:
        str: JSON with 'map_mmhg' (float, 1dp)
    """
    if not _valid_blood_pressure(systolic_mmhg, diastolic_mmhg):
        return json.dumps({"error": "blood pressure values must be 30-350 mmHg and systolic >= diastolic"})
    map_value = round(
        diastolic_mmhg + (systolic_mmhg - diastolic_mmhg) / 3, 1
    )
    return f'{{"map_mmhg": {map_value}}}'


@mcp.tool(
    name="clinical_calculate_pulse_pressure",
    annotations=_annotations("Calculate Pulse Pressure"),
)
async def clinical_calculate_pulse_pressure(systolic_mmhg: float, diastolic_mmhg: float) -> str:
    """Calculate Pulse Pressure (systolic minus diastolic BP).

    Args:
        systolic_mmhg: Systolic blood pressure in mmHg (e.g. 120)
        diastolic_mmhg: Diastolic blood pressure in mmHg (e.g. 80)

    Returns:
        str: JSON with 'pulse_pressure_mmhg' (float, 1dp)
    """
    if not _valid_blood_pressure(systolic_mmhg, diastolic_mmhg):
        return json.dumps({"error": "blood pressure values must be 30-350 mmHg and systolic >= diastolic"})
    pp = round(systolic_mmhg - diastolic_mmhg, 1)
    return f'{{"pulse_pressure_mmhg": {pp}}}'


# ---------------------------------------------------------------------------
# Day 2: Evidence query against your live Clinical RAG Agent backend
# ---------------------------------------------------------------------------


@mcp.tool(
    name="clinical_query_evidence",
    annotations=_annotations("Query Clinical Evidence RAG Agent", idempotent=False, open_world=True),
)
async def clinical_query_evidence(
    question: str,
    mode: str = "patient",
) -> str:
    """Route a hypertension-care question through the live Clinical Evidence
    RAG Agent (hybrid retrieval + safety-gated generation).

    Calls POST {CLINICAL_RAG_API_URL}/api/query with the backend's
    QueryRequest shape (app/models.py); returns the QueryResponse answer
    with citations appended.

    Args:
        question: Clinical workflow or hypertension question
        mode: Response style ('patient' for plain language or 'clinician' for technical summary)

    Returns:
        str: The agent's answer, or an error message if the backend is
             unreachable or unconfigured.
    """
    if not CLINICAL_RAG_API_URL:
        return (
            "Error: CLINICAL_RAG_API_URL is not set. Set it to your deployed "
            "backend URL (e.g. https://clinical-workflows.vercel.app) before using "
            "this tool."
        )

    base_url = CLINICAL_RAG_API_URL.rstrip("/")
    if base_url.endswith("/query"):
        endpoint = base_url
    elif base_url.endswith("/api"):
        endpoint = f"{base_url}/query"
    else:
        endpoint = f"{base_url}/api/query"

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                endpoint,
                json={"question": question, "mode": mode},
            )
            response.raise_for_status()
            data = response.json()
            answer = data.get("answer")
            if not answer:
                return str(data)

            citations = data.get("citations", [])
            if citations:
                citation_lines = []
                for c in citations:
                    title = c.get("title") or c.get("source_id") or "Source"
                    url = c.get("source_url") or ""
                    page = c.get("page")
                    page_str = f" (p. {page})" if page is not None else ""
                    quote = (c.get("quote") or "").strip()
                    quote_str = f' — "{quote}"' if quote else ""
                    if url:
                        citation_lines.append(f"- [{title}{page_str}]({url}){quote_str}")
                    else:
                        citation_lines.append(f"- {title}{page_str}{quote_str}")
                if citation_lines:
                    answer += "\n\n**Sources & Citations:**\n" + "\n".join(citation_lines)

            return answer
    except httpx.HTTPStatusError as e:
        detail = ""
        if e.response.status_code == 422:
            try:
                err = e.response.json().get("error", {})
                details = err.get("details", [])
                detail = "; ".join(
                    f"{d.get('field')}: {d.get('message')}" for d in details
                ) or err.get("message", "")
            except Exception:
                pass
            return f"Error: backend rejected the request (422 validation_error). {detail}".strip()
        return f"Error: backend returned status {e.response.status_code} at {endpoint}. Check that the URL is reachable."
    except httpx.TimeoutException:
        return "Error: request to the Clinical RAG backend timed out."
    except httpx.RequestError:
        return f"Error: could not reach the Clinical RAG backend at {endpoint}. Check the URL and network."
    except Exception as e:
        return f"Error: unexpected failure calling the backend: {type(e).__name__}: {e}"


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
