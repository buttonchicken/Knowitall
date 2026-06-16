# Know It All — Frontend

Deep-dive B2B research UI. Paste a company URL, get a structured research report in seconds, then ask follow-up questions in a streaming chat.

## What it does

- Submits a company URL to a backend research API and renders the structured report
- Report sections: company overview, products & services, target customers, business signals, risks & challenges, suggested discovery questions, outreach strategy, and sources
- Export the report to PDF (via html2canvas + jsPDF)
- Streaming chat panel to ask follow-up questions about the researched company

## Tech stack

| Tool | Version |
|---|---|
| React | 18 |
| TypeScript | 5 |
| Vite | 5 |
| Tailwind CSS | 3 |
| html2canvas + jsPDF | PDF export |

## Prerequisites

- Node.js 18+
- The backend API server running at `http://localhost:8000` (provides `/research` and `/chat` endpoints)

## Getting started

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/research` to the backend.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |

## API contract

### `GET /research?url=<company-url>`

Returns a `ResearchReport` JSON object:

```ts
{
  company_overview: string
  products_and_services: string[]
  target_customers: string[]
  business_signals: string[]
  risks_and_challenges: string[]
  suggested_discovery_questions: string[]
  suggested_outreach_strategy: string
  unknowns: string[]
  sources: string[]
}
```

### `POST /chat`

Accepts `{ report, history, question }` and streams back SSE tokens in the format:

```
data: {"token": "..."}
data: [DONE]
```

## Project structure

```
src/
  App.tsx        # Main app — URL input, report rendering, PDF download
  ChatPanel.tsx  # Streaming chat panel scoped to the current report
  index.css      # Tailwind base styles
  main.tsx       # React entry point
```
