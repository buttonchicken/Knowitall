# Knowitall

A B2B sales intelligence agent that takes a company URL, autonomously scrapes the target website, and returns a structured sales research report — plus a streaming Q&A chat interface grounded on that report.

---

## Architecture

```
GET /research?url=...
      │
      ▼
  LangGraph StateGraph
      │
      ├── Node 1: scraper_layer
      │     └── crawl4ai AsyncWebCrawler
      │           ├── Crawls homepage
      │           ├── Extracts nav/footer internal links (depth ≤ 3, no app subdomains)
      │           ├── Concurrently crawls up to 25 subpages via asyncio.gather
      │           └── Caps combined markdown output at 80,000 chars
      │
      └── Node 2: intel_layer
            └── LLM with structured output → SalesResearchReport (Pydantic)
                  ├── Primary:  GPT-4o (OpenAI)
                  └── Fallback: Llama-3.3-70b-versatile (Groq)

POST /chat
      └── Stateless streaming chat, grounded on the report JSON
            ├── Primary:  GPT-4o via SSE token stream
            └── Fallback: Llama-3.3-70b (Groq) on any exception
```

---

## File Overview

| File | Role |
|---|---|
| `main.py` | FastAPI app — `/research` and `/chat` endpoints |
| `workflow.py` | LangGraph `StateGraph` — two-node pipeline |
| `scraper.py` | Async web crawler — URL normalization, link extraction, markdown aggregation |
| `schema.py` | Pydantic v2 `SalesResearchReport` model — output contract for LLM and API |

---

## Data Flow

```
URL
 → normalize to marketing homepage (strip app subdomains)
 → crawl homepage + up to 25 subpages concurrently
 → concatenate markdown, cap at 80k chars, tag with source URLs
 → GPT-4o (or Llama-3.3 fallback) with structured output
 → SalesResearchReport JSON

Report + chat history + question
 → grounded system prompt
 → GPT-4o streaming SSE tokens to frontend
```

---

## Report Schema

`SalesResearchReport` fields extracted by the LLM:

- `company_overview` — what the company does
- `products_and_services` — specific product/service names
- `target_customers` — named customer segments or actual customers
- `business_signals` — hiring trends, funding, expansions, partnerships
- `risks_and_challenges` — competitive pressures, market headwinds
- `suggested_discovery_questions` — grounded in the company's actual products and pain points
- `suggested_outreach_strategy` — derived from their real business model
- `unknowns` — fields where data wasn't found in the scraped content
- `sources` — exact URLs that appeared in the scraped content

---

## Stack

- **FastAPI** + **Uvicorn** — async HTTP server
- **LangGraph** — stateful agent pipeline (`StateGraph`)
- **LangChain** — LLM abstraction (`ChatOpenAI`, `ChatGroq`, `.with_structured_output`)
- **crawl4ai** — async headless web crawler
- **Pydantic v2** — structured output schema and request/response validation
- **OpenAI GPT-4o** — primary LLM for report generation and chat
- **Groq Llama-3.3-70b** — fallback LLM on any OpenAI exception
- **SSE (Server-Sent Events)** — token-level streaming for the chat endpoint

---

## Setup

```bash
# Create and activate virtual environment
python -m venv kall
source kall/bin/activate

# Install dependencies
pip install -r req.txt

# Configure environment variables by adding OPENAI_API_KEY and GROQ_API_KEY to .env

# Run the server
python main.py
# Server starts at http://127.0.0.1:8000
```

---

## API

### `GET /research?url=<company-url>`

Runs the full scrape → LLM pipeline and returns a `SalesResearchReport`.

```bash
curl "http://localhost:8000/research?url=stripe.com"
```

### `POST /chat`

Streams a grounded answer to a follow-up question about the report.

```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "report": { ... },
    "history": [],
    "question": "Who are their main competitors?"
  }'
```

Response is a stream of `text/event-stream` events:
```
data: {"token": "Based"}
data: {"token": " on"}
...
data: [DONE]
```
