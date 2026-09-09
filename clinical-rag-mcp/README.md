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
| `clinical_query_evidence` | Routes a question through the live RAG backend | Requires `CLINICAL_RAG_API_URL` env var - see below |

## Setup

```bash
pip install -r requirements.txt
```

For the calculators, no configuration is needed - they run standalone.

For `clinical_query_evidence`, set the backend URL as an environment variable:

```bash
export CLINICAL_RAG_API_URL="https://clinical-workflows.vercel.app"
```

The live Clinical Evidence RAG backend is hosted via Vercel serverless functions at `https://clinical-workflows.vercel.app/api/query`, returning answers along with guideline citations and safety reports.

## Testing locally

Use the virtual environment created in `clinical-rag-mcp`:

```bash
# Test in terminal
./venv/bin/python3 -c "import asyncio, os; os.environ['CLINICAL_RAG_API_URL']='https://clinical-workflows.vercel.app'; from server import clinical_calculate_bmi, BMIInput; print(asyncio.run(clinical_calculate_bmi(BMIInput(weight_kg=70, height_m=1.75))))"

# Or test with the official MCP Inspector
npx @modelcontextprotocol/inspector ./venv/bin/python3 server.py
```

## Using with Claude Desktop (Zero-Install from GitHub)

Anyone can add this to their `claude_desktop_config.json` without cloning the repo:

```json
{
  "mcpServers": {
    "clinical-rag": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/jeevesh2515/clinical-rag-agent.git#subdirectory=clinical-rag-mcp",
        "clinical-rag-mcp"
      ],
      "env": {
        "CLINICAL_RAG_API_URL": "https://clinical-workflows.vercel.app"
      }
    }
  }
}
```

Restart Claude Desktop and the four clinical tools will appear in your Connectors and chat tool picker.

## Using with Claude Code (One-Command Install)

Run anywhere:

```bash
claude mcp add --scope user clinical-rag \
  -e CLINICAL_RAG_API_URL=https://clinical-workflows.vercel.app \
  -- uvx --from "git+https://github.com/jeevesh2515/clinical-rag-agent.git#subdirectory=clinical-rag-mcp" clinical-rag-mcp
```

## Notes on the calculator implementations

The three calculators in `server.py` use standard, publicly documented
clinical formulas, included so this server runs end to end without any
external dependency. The parent Clinical Evidence RAG Agent project has its
own tested versions of these same calculators. Before treating this as
production-parity with that project, swap these for the real implementation
(import or vendor the module) so there is one tested source of truth rather
than two versions that can drift apart.
