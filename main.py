"""
Endpoints:
  POST /api/ingest          – Upload and ingest documents
  POST /api/chat            – Chat with SSE streaming
  GET  /api/stats           – Knowledge graph statistics
  GET  /api/documents       – List ingested documents
  DELETE /api/documents/{id} – Delete a document
  GET  /api/health          – System health check
"""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import TOP_K_VECTOR
from graph_db import db
from ingestion import ingest_document
from agent import run_agent_streaming
from ollama_client import check_ollama_health

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


#  Lifespan (startup/shutdown)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting GraphRAG backend...")
    db.connect()
    db.setup_schema()
    yield
    db.close()
    logger.info("GraphRAG backend shut down")


#  App

app = FastAPI(
    title="GraphRAG API",
    description="LLM chain using GraphRAG with Neo4j + Ollama",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#  Models
class ChatRequest(BaseModel):
    query: str
    conversation_history: list[dict] = []
    top_k: int = TOP_K_VECTOR


class IngestStatus(BaseModel):
    job_id: str
    status: str
    filename: str


# In-memory job store for ingestion progress
_ingest_jobs: dict[str, dict] = {}

#  Ingestion endpoint
@app.post("/api/ingest")
async def ingest_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    filename = file.filename or "unknown"
    job_id = str(uuid.uuid4())

    async def _event_stream() -> AsyncGenerator[str, None]:
        _ingest_jobs[job_id] = {"status": "running", "stages": []}

        def progress_cb(msg: str):
            _ingest_jobs[job_id]["stages"].append(msg)

        try:
            yield _sse({"type": "start", "job_id": job_id, "filename": filename})

            result = await ingest_document(
                file_bytes, filename, progress_cb=progress_cb
            )

            _ingest_jobs[job_id]["status"] = "done"
            _ingest_jobs[job_id]["result"] = result
            yield _sse({"type": "done", **result})

        except Exception as e:
            logger.error(f"Ingestion error: {e}", exc_info=True)
            _ingest_jobs[job_id]["status"] = "error"
            yield _sse({"type": "error", "message": str(e)})

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
#  Chat endpoint (SSE streaming)
@app.post("/api/chat")
async def chat(req: ChatRequest):
    """
    Chat with the GraphRAG agent. Streams tokens via SSE.
    Event types:
      thinking  – agent reasoning step
      tool_call – agent calling a tool
      tool_result – result count from tool
      token     – LLM output token
      done      – stream complete
      error     – error occurred
    """
    async def _event_stream() -> AsyncGenerator[str, None]:
        try:
            async for event in run_agent_streaming(
                user_query=req.query,
                conversation_history=req.conversation_history,
            ):
                yield _sse(event)
        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            yield _sse({"type": "error", "content": str(e)})

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
#  Stats & documents
@app.get("/api/stats")
async def get_stats():
    try:
        stats = db.get_stats()
        return {"status": "ok", **stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents")
async def list_documents():
    """List all ingested documents."""
    try:
        docs = db.list_documents()
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    try:
        db.delete_document(doc_id)
        return {"status": "deleted", "doc_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


#  Health

@app.get("/api/health")
async def health():
    ollama = await check_ollama_health()
    neo4j_ok = False
    try:
        db.get_stats()
        neo4j_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if (neo4j_ok and ollama["status"] == "ok") else "degraded",
        "neo4j": "ok" if neo4j_ok else "error",
        "ollama": ollama,
    }


# SSE helper

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


# Dev server

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
