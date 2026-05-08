import json
import asyncio
import logging
from typing import AsyncGenerator

from ollama_client import chat_streaming
from retriever import retrieve, build_rag_prompt
from graph_db import db

logger = logging.getLogger(__name__)

GENERAL_PATTERNS = [
    # greetings
    "hi", "hello", "hey", "good morning", "good evening", "how are you",
    "what's up", "whats up",
    # math / conversions
    "convert ", "calculate ", "how much is ", "exchange rate",
    "usd to", "to rupees", "to dollars", "to euros", "currency",
    "price of", "cost of", "km to", "celsius", "fahrenheit",
    # general knowledge
    "who is ", "who was ", "what is the capital",
    "how does ", "define ", "meaning of ", "what does ",
    "when was ", "what year ",
    # coding / tech
    "write a code", "write code", "write a script",
    "how to install", "python code", "javascript",
    # time / date
    "what time", "what day", "today's date", "current time",
    "what is today",
]

GENERAL_SYSTEM = """You are a helpful, friendly assistant. 
Answer the user's question directly and accurately using your general knowledge. 
Be concise and clear."""

REACT_SYSTEM = """You are a research assistant with access to a knowledge graph of ingested documents.
Answer ONLY based on the context provided. Do not make up information.
If context is insufficient, say so clearly."""


def _is_general_question(query: str) -> bool:
    """Detect general knowledge questions that don't need document search."""
    q = query.lower().strip()
    return any(p in q for p in GENERAL_PATTERNS)

#  Core agent loop
async def run_agent_streaming(
    user_query: str,
    conversation_history: list[dict] | None = None,
    max_iterations: int = 3,
) -> AsyncGenerator[dict, None]:
    """
    Stream agent events:
      {"type": "tool_call",   "tool": "...", "args": {...}}
      {"type": "tool_result", "content": "..."}
      {"type": "token",       "content": "..."}
      {"type": "done",        "sources": [...]}
    """
    all_sources = []
    if _is_general_question(user_query):
        logger.info(" General question — answering directly")
        try:
            async for token in chat_streaming(
                [{"role": "user", "content": user_query}],
                system=GENERAL_SYSTEM
            ):
                yield {"type": "token", "content": token}
        except Exception as e:
            yield {"type": "token", "content": f"Error: {e}"}
        yield {"type": "done", "sources": []}
        return

    # Document question → search knowledge graph
    yield {"type": "tool_call", "tool": "graphrag_search", "args": {"query": user_query}}

    context = ""
    try:
        result = await retrieve(user_query, top_k=5)
        all_sources = result.get("all_chunks", [])
        context = result.get("context", "")
        yield {"type": "tool_result", "content": f"Found {len(all_sources)} relevant chunks"}
        logger.info(f" Retrieved {len(all_sources)} chunks")
    except Exception as e:
        logger.error(f"Retrieval error: {e}", exc_info=True)
        yield {"type": "tool_result", "content": f"Search error: {str(e)[:100]}"}

    #  Step 2: Fallback — get any chunks from graph
    if not all_sources:
        logger.info("No vector results — trying fallback chunk fetch")
        try:
            fallback = db.get_all_chunks(top_k=5)
            if fallback:
                all_sources = fallback
                context = "\n\n".join(c.get("text", "") for c in fallback)
                yield {"type": "tool_result", "content": f"Using {len(fallback)} chunks from graph"}
        except Exception as e:
            logger.error(f"Fallback failed: {e}")

    if not all_sources:
        yield {"type": "token", "content": "I could not find relevant information in the knowledge graph. Please upload and ingest documents first using the Upload tab on the left."}
        yield {"type": "done", "sources": []}
        return

    system_prompt, user_prompt = build_rag_prompt(user_query, context)
    try:
        async for token in chat_streaming(
            [{"role": "user", "content": user_prompt}],
            system=system_prompt
        ):
            yield {"type": "token", "content": token}
    except Exception as e:
        logger.error(f"LLM error: {e}")
        yield {"type": "token", "content": f"Error generating answer: {e}"}

    yield {"type": "done", "sources": all_sources[:5]}