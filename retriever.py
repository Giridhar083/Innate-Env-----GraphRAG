"""
Combines two strategies:
   Vector Search  - semantic similarity via Neo4j vector index
   Graph Traversal - structural context via [:NEXT_CHUNK] edges
   Fallback text search if vector index fails
"""

from config import TOP_K_VECTOR, GRAPH_HOP_DEPTH
from graph_db import db
from ollama_client import embed_text
import logging

logger = logging.getLogger(__name__)


async def retrieve(query: str, top_k: int = TOP_K_VECTOR) -> dict:
    # Embed query
    logger.info(f"Embedding query: {query[:60]}...")
    try:
        query_embedding = await embed_text(query)
        logger.info(f"Embedding done, dims={len(query_embedding)}")
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return _empty_result()

    # Vector search
    vector_results = []
    try:
        vector_results = db.vector_search(query_embedding, top_k=top_k)
        logger.info(f"Vector search returned {len(vector_results)} chunks")
    except Exception as e:
        logger.warning(f"Vector search failed: {e} — falling back to text search")

    # Fallback: full-text search if vector returns nothing
    if not vector_results:
        logger.info("Trying text search fallback...")
        try:
            vector_results = db.text_search(query, top_k=top_k)
            logger.info(f"Text search returned {len(vector_results)} chunks")
        except Exception as e:
            logger.error(f"Text search also failed: {e}")
            return _empty_result()

    if not vector_results:
        logger.warning("No chunks found via any search method")
        return _empty_result()

    #Graph traversal
    graph_results = []
    try:
        seed_ids = [r["id"] for r in vector_results]
        graph_results = db.graph_expand(seed_ids, hop_depth=GRAPH_HOP_DEPTH)
        logger.info(f"Graph traversal returned {len(graph_results)} chunks")
    except Exception as e:
        logger.warning(f"Graph traversal failed: {e} — using vector results only")

    # Deduplicate & merge
    seen_ids = set()
    all_chunks = []

    for chunk in vector_results:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            all_chunks.append({**chunk, "source": "vector"})

    for chunk in graph_results:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            all_chunks.append({**chunk, "source": "graph"})

    all_chunks.sort(key=lambda c: (c.get("doc_id", ""), c.get("idx", 0)))

    context_parts = []
    current_doc = None
    for chunk in all_chunks:
        doc = chunk.get("doc_id", "unknown")
        if doc != current_doc:
            context_parts.append(f"\n--- Document: {doc} ---\n")
            current_doc = doc
        context_parts.append(chunk.get("text", ""))

    context = "\n".join(context_parts)
    logger.info(f"Final context: {len(all_chunks)} chunks, {len(context)} chars")

    return {
        "context": context,
        "vector_chunks": [r for r in all_chunks if r.get("source") == "vector"],
        "graph_chunks":  [r for r in all_chunks if r.get("source") == "graph"],
        "all_chunks":    all_chunks,
    }


def _empty_result():
    return {"context": "", "vector_chunks": [], "graph_chunks": [], "all_chunks": []}


def build_rag_prompt(query: str, context: str) -> tuple[str, str]:
    system = """You are an expert research assistant with access to a knowledge graph.
Use ONLY the provided context to answer the question.
If the context does not contain enough information, say so clearly.
Be thorough but concise."""

    user = f"""Context from Knowledge Graph:
{context}

---

Question: {query}

Provide a detailed, accurate answer based strictly on the context above."""

    return system, user