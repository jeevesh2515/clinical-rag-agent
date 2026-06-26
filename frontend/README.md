# ClinicalRAG Frontend

A polished React + Vite + TypeScript + Tailwind CSS frontend for the ClinicalRAG agentic clinical workflow assistant.

## Features

- **Dark-mode first design** with medical-grade teal accent palette
- **Dual mode interface**: Patient vs Clinician mode selector
- **Synthetic case selector**: 5 pre-built hypertension cases for demo
- **Rich chat interface** with suggested questions and loading states
- **Citation panel**: Expandable source quotes with provenance metadata
- **Tool trace panel**: Visual agent reasoning steps
- **Safety panel**: Real-time safety flag visualization with refusal reasons
- **Retrieval panel**: Dense, sparse, hybrid, and rerank scores per chunk
- **System status dashboard**: Document counts, ingestion controls, quick start guide
- **Evaluation dashboard**: Run and view RAGAS-compatible quality metrics
- **Responsive design**: Works on desktop and mobile

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Lucide React (icons)

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The Vite dev server proxies API calls to the backend at `http://127.0.0.1:8000` automatically.

## Build for Production

```bash
npm run build
```

Static files are output to `dist/`. Serve with any static file server.

## Backend Connection

The frontend expects the FastAPI backend to be running at `http://127.0.0.1:8000`.

Make sure the backend CORS is configured to allow `http://localhost:5173` (default in `.env.example`).

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── HeroSection.tsx          # Landing page hero with feature grid
│   │   ├── QueryInterface.tsx       # Main chat + side panel layout
│   │   ├── ModeSelector.tsx         # Patient / Clinician toggle
│   │   ├── CaseSelector.tsx         # Synthetic case dropdown
│   │   ├── CitationsPanel.tsx       # Expandable citation quotes
│   │   ├── ToolTracePanel.tsx       # Agent tool trace visualization
│   │   ├── SafetyPanel.tsx          # Safety flags + refusal display
│   │   ├── RetrievalPanel.tsx       # Retrieval scores table
│   │   ├── EvalDashboard.tsx        # Evaluation metrics view
│   │   └── StatusBadge.tsx          # Intent + confidence + mode badges
│   ├── hooks/
│   │   └── useApi.ts                # FastAPI client hooks
│   ├── types/
│   │   └── api.ts                   # Pydantic model TypeScript mirrors
│   ├── lib/
│   │   └── utils.ts                 # cn(), formatters, color helpers
│   ├── App.tsx                      # Main app with routing tabs
│   ├── main.tsx                     # Entry point
│   └── index.css                    # Tailwind + custom glassmorphism utilities
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tailwind.config.js
```
