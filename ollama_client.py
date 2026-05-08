"""
Ollama API wrappers for:
  - nomic-embed-text  →  768-dim embeddings
  - llama3.1          →  reasoning / generation
  - moondream         →  vision (image → text description)
"""

import httpx
import base64
import asyncio
import json
from config import OLLAMA_BASE_URL, LLM_MODEL, VISION_MODEL, EMBED_MODEL
from typing import AsyncGenerator
import logging

logger = logging.getLogger(__name__)

# Shared async client
# Vision model (moondream) needs much longer timeout per image
_client = httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=300.0)
_vision_client = httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=600.0)

# Embeddings  (nomic-embed-text)


async def embed_text(text: str) -> list[float]:
    resp = await _client.post("/api/embeddings", json={
        "model": EMBED_MODEL,
        "prompt": text
    })
    resp.raise_for_status()
    return resp.json()["embedding"]


async def embed_texts_batch(texts: list[str], batch_size: int = 8) -> list[list[float]]:
    results = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = await asyncio.gather(*[embed_text(t) for t in batch])
        results.extend(embeddings)
    return results

#  LLM generation  (llama3.1)


async def generate_streaming(prompt: str, system: str = "") -> AsyncGenerator[str, None]:
    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": True,
    }
    if system:
        payload["system"] = system

    async with _client.stream("POST", "/api/generate", json=payload) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
                token = data.get("response", "")
                if token:
                    yield token
                if data.get("done"):
                    break
            except json.JSONDecodeError:
                continue


async def generate(prompt: str, system: str = "") -> str:
    tokens = []
    async for token in generate_streaming(prompt, system):
        tokens.append(token)
    return "".join(tokens)


async def chat_streaming(
    messages: list[dict],
    system: str = ""
) -> AsyncGenerator[str, None]:
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": True,
    }
    if system:
        payload["system"] = system

    async with _client.stream("POST", "/api/chat", json=payload) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
                token = data.get("message", {}).get("content", "")
                if token:
                    yield token
                if data.get("done"):
                    break
            except json.JSONDecodeError:
                continue

#  Vision  (moondream)


async def describe_image(image_bytes: bytes, prompt: str = "Describe this image briefly.") -> str:
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "model": VISION_MODEL,
        "prompt": prompt,
        "images": [b64],
        "stream": False,
    }
    try:
        resp = await _vision_client.post("/api/generate", json=payload)
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as e:
        logger.warning(f"Vision model failed for image: {e}")
        return ""  # skip image gracefully instead of crashing


async def describe_images_batch(
    images: list[bytes],
    prompt: str = "Describe this image briefly for document indexing.",
    max_images: int = 5,
) -> list[str]:
    results = []
    # Cap number of images to avoid very long ingestion times
    images_to_process = images[:max_images]
    logger.info(f"Processing {len(images_to_process)} of {len(images)} images sequentially")

    for i, img_bytes in enumerate(images_to_process):
        logger.info(f"Describing image {i+1}/{len(images_to_process)}...")
        desc = await describe_image(img_bytes, prompt)
        results.append(desc)

    return results

#  Health check

async def check_ollama_health() -> dict:
    try:
        resp = await _client.get("/api/tags")
        resp.raise_for_status()
        available = [m["name"] for m in resp.json().get("models", [])]
        needed = [LLM_MODEL, VISION_MODEL, EMBED_MODEL]
        missing = [m for m in needed if not any(m in a for a in available)]
        return {
            "status": "ok" if not missing else "degraded",
            "available_models": available,
            "missing_models": missing,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}