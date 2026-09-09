# Clinical RAG MCP Server

An MCP (Model Context Protocol) server that exposes clinical calculators and
the [Clinical Evidence RAG Agent](https://clinical-workflows.vercel.app) as
tools callable directly from Claude Desktop or Claude Code.

## Why this exists

Built as a companion to the Clinical Evidence RAG Agent project, this server
turns that agent's retrieval and calculator logic into MCP tools - so instead
of opening a browser tab, you can ask Claude directly:

> "What's the MAP for a patient at 140/90?"
> "What does the guideline say about follow-up intervals for stage 2 hypertension?"

and Claude calls the tool itself.

## Tools

| Tool | Description | Status |
|---|---|---|
| `clinical_calculate_bmi` | BMI + WHO category from weight/height | Working, standalone |
| `clinical_calculate_map` | Mean Arterial Pressure from BP | Working, standalone |
| `clinical_calculate_pulse_pressure` | Pulse pressure from BP | Working, standalone |
| `clinical_query_evidence` | Routes a question through the live RAG backend | Uses the deployed Clinical Workflows URL by default; override with `CLINICAL_RAG_API_URL` |

## Setup

```bash
pip install -r requirements.txt
```

For the calculators, no configuration is needed - they run standalone.

To point `clinical_query_evidence` at another deployment, set the backend URL:

```bash
export CLINICAL_RAG_API_URL="https://clinical-workflows.vercel.app"
```

The live Clinical Evidence RAG backend is hosted via Vercel serverless functions at `https://clinical-workflows.vercel.app/api/query`, returning answers along with guideline citations and safety reports.

## Testing locally

Use the virtual environment created in `clinical-rag-mcp`:

```bash
# Calculator contract and live evidence-query smoke test
./venv/bin/python3 test_tools.py

# Or test with the official MCP Inspector
npx @modelcontextprotocol/inspector ./venv/bin/python3 server.py
```

## Using with Claude Desktop (Zero-Install from GitHub)

Anyone can add this to their `claude_desktop_config.json` without cloning the repo:

```json
{
  "mcpServers": {
    "clinical-rag": {
      "command": "uv",
      "args": [
        "run",
        "https://raw.githubusercontent.com/jeevesh2515/clinical-rag-agent/main/clinical-rag-mcp/server.py"
      ]
    }
  }
}
```

Restart Claude Desktop and the four clinical tools will appear in your Connectors and chat tool picker.

## Using with Claude Code (One-Command Install)

Run anywhere:

```bash
claude mcp add --scope user clinical-rag -- uv run https://raw.githubusercontent.com/jeevesh2515/clinical-rag-agent/main/clinical-rag-mcp/server.py
```


## Data boundary and calculator contract

The three calculators are deliberately standalone so the zero-install MCP
server has no dependency on the web application's Python environment. Their
accepted ranges and expected outputs are asserted by `test_tools.py`; update
that contract alongside any formula change in the web application.

The MCP process does not receive a browser JWT and does not access account,
conversation, upload, or profile data. Use it for public educational guideline
questions only. Do not send PHI to the public evidence endpoint.
