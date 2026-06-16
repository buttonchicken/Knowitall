import os
from typing import TypedDict, Optional
from dotenv import load_dotenv
from langgraph.graph import START, END, StateGraph
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq

from schema import SalesResearchReport
from scraper import scrape_company_website

load_dotenv()


class SalesCopilotState(TypedDict):
    company_url: str
    raw_markdown_data: str
    report: Optional[SalesResearchReport]


async def crawl_site_node(state: SalesCopilotState):
    content = await scrape_company_website(state["company_url"])
    return {"raw_markdown_data": content}


async def generate_report_node(state: SalesCopilotState):
    openai_model = ChatOpenAI(
        model="gpt-4o",
        temperature=0.2,
        api_key=os.getenv("OPENAI_API_KEY")
    ).with_structured_output(SalesResearchReport)

    groq_model = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.2,
        api_key=os.getenv("GROQ_API_KEY")
    ).with_structured_output(SalesResearchReport)

    system_prompt = """You are an elite B2B Sales Intelligence Analyst. Your job is to extract \
concrete, specific, verifiable intelligence from scraped company website text.

STRICT RULES:
- Every field must contain REAL data found in the text. Quote specific product names, \
job titles, dollar figures, customer names, technologies, and dates when present.
- NEVER use generic placeholders like "consulting services", "ideal customer profiles", \
"hiring trends", "market headwinds", "What are your current challenges", or \
"Tailored pitch based on active vulnerabilities". These are worthless.
- If you cannot find specific data for a field, add the field name to `unknowns` and \
write a factual best-effort summary from context rather than a placeholder.
- `sources` must list only the exact URLs that appeared in the scraped text headers \
(format: "--- SOURCE: <url> ---").
- `suggested_discovery_questions` must reference the company's specific products, \
customers, or pain points — not generic sales openers.
- `suggested_outreach_strategy` must name a specific angle derived from their \
actual business model and signals found in the text."""

    user_prompt = f"""Research target: {state['company_url']}

Scraped content (multiple pages, each prefixed with its source URL):
{state['raw_markdown_data']}

Extract a complete, specific intelligence report. Use only what is actually in the text above."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    try:
        structured_data = await openai_model.ainvoke(messages)
    except Exception:
        structured_data = await groq_model.ainvoke(messages)

    return {"report": structured_data}


workflow = StateGraph(SalesCopilotState)
workflow.add_node("scraper_layer", crawl_site_node)
workflow.add_node("intel_layer", generate_report_node)

workflow.add_edge(START, "scraper_layer")
workflow.add_edge("scraper_layer", "intel_layer")
workflow.add_edge("intel_layer", END)

agent_app = workflow.compile()
