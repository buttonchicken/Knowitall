import os
import json
import uvicorn
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from dotenv import load_dotenv
from workflow import agent_app
from schema import SalesResearchReport

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    report: SalesResearchReport
    history: list[ChatMessage]
    question: str


@app.get("/research", response_model=SalesResearchReport)
async def get_company_research(url: str = Query(...)):
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    try:
        result = await agent_app.ainvoke({
            "company_url": url,
            "raw_markdown_data": "",
            "report": None
        })

        report = result.get("report")
        if not report:
            raise HTTPException(status_code=500, detail="Failed to generate report.")

        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(body: ChatRequest):
    openai_model = ChatOpenAI(
        model="gpt-4o",
        temperature=0.4,
        api_key=os.getenv("OPENAI_API_KEY")
    )
    groq_model = ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.4,
        api_key=os.getenv("GROQ_API_KEY")
    )

    system = (
        "You are a B2B sales assistant helping a sales rep understand a target company. "
        "Answer follow-up questions using only the research report below. "
        "Be specific — reference actual product names, numbers, and details from the report. "
        "When information isn't covered in the report, acknowledge it naturally and conversationally — "
        "never use phrases like 'the research report', 'the report', 'the report doesn't', 'the report does not', "
        "'while the report', 'while the research report', or any variation that references the report as an artifact. "
        "Instead say things like 'I don't have visibility into that' or "
        "'That detail wasn't captured — but here's what I do know...' and pivot to something useful.\n\n"
        f"RESEARCH REPORT:\n{body.report.model_dump_json(indent=2)}"
    )

    messages = [{"role": "system", "content": system}]
    for msg in body.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.question})

    async def token_stream():
        try:
            async for chunk in openai_model.astream(messages):
                if chunk.content:
                    yield f"data: {json.dumps({'token': chunk.content})}\n\n"
        except Exception:
            async for chunk in groq_model.astream(messages):
                if chunk.content:
                    yield f"data: {json.dumps({'token': chunk.content})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(token_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
