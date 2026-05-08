"""
Ingestion Pipeline
PDF · DOCX · TXT · CSV · JSON · MD → parse → chunk → embed → store in Neo4j
Steps:
  1. Parse file  (extract text + image bytes)
  2. Vision      (moondream: image bytes → text description)
  3. Chunk       (500 tokens, 60 overlap, recursive split)
  4. Embed       (nomic-embed-text, 768 dims)
  5. Store       (Neo4j nodes + vector + sequential edges)
"""

import io
import uuid
import hashlib
import asyncio
import logging
from pathlib import Path
from typing import Callable, AsyncGenerator

import fitz          # PyMuPDF
import docx
import csv

from langchain.text_splitter import RecursiveCharacterTextSplitter

from config import CHUNK_SIZE, CHUNK_OVERLAP
from graph_db import db
from ollama_client import embed_texts_batch, describe_images_batch

logger = logging.getLogger(__name__)


# Text splitter
splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)

#  Parsers
def parse_pdf(file_bytes: bytes) -> tuple[str, list[bytes]]:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = []
    image_bytes_list = []

    for page in doc:
        full_text.append(page.get_text("text"))
        for img in page.get_images(full=True):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes_list.append(base_image["image"])

    doc.close()
    return "\n".join(full_text), image_bytes_list


def parse_docx(file_bytes: bytes) -> tuple[str, list[bytes]]:
    doc = docx.Document(io.BytesIO(file_bytes))
    text = "\n".join(p.text for p in doc.paragraphs)
    # Extract embedded images
    images = []
    for rel in doc.part.rels.values():
        if "image" in rel.target_ref:
            try:
                images.append(rel.target_part.blob)
            except Exception:
                pass
    return text, images


def parse_text(file_bytes: bytes, filename: str) -> tuple[str, list[bytes]]:
    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        reader = csv.reader(io.StringIO(file_bytes.decode("utf-8", errors="replace")))
        text = "\n".join(", ".join(row) for row in reader)
    elif ext == ".json":
        import json
        data = json.loads(file_bytes.decode("utf-8", errors="replace"))
        text = json.dumps(data, indent=2)
    else:  # .txt, .md
        text = file_bytes.decode("utf-8", errors="replace")
    return text, []


def parse_file(file_bytes: bytes, filename: str) -> tuple[str, list[bytes]]:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return parse_pdf(file_bytes)
    elif ext in (".docx", ".doc"):
        return parse_docx(file_bytes)
    else:
        return parse_text(file_bytes, filename)

#  Pipeline
async def ingest_document(
    file_bytes: bytes,
    filename: str,
    progress_cb: Callable[[str], None] | None = None,
) -> dict:
    def _progress(msg: str):
        logger.info(msg)
        if progress_cb:
            progress_cb(msg)

    doc_id = hashlib.sha256(file_bytes).hexdigest()[:16]

    # 1. Parse
    _progress(" Parsing document...")
    raw_text, image_bytes_list = parse_file(file_bytes, filename)

    # 2. Vision (moondream)
    image_descriptions = []
    if image_bytes_list:
        _progress(f" Describing {len(image_bytes_list)} image(s) with moondream...")
        image_descriptions = await describe_images_batch(image_bytes_list)

    # Append image descriptions as additional text
    if image_descriptions:
        raw_text += "\n\n" + "\n\n".join(
            f"[Image {i+1}]: {desc}" for i, desc in enumerate(image_descriptions)
        )

    # 3. Chunk
    _progress("Chunking text...")
    chunks = splitter.split_text(raw_text)
    if not chunks:
        return {"doc_id": doc_id, "chunks": 0, "error": "No text extracted"}

    # 4. Embed
    _progress(f"Embedding {len(chunks)} chunks with nomic-embed-text...")
    embeddings = await embed_texts_batch(chunks)

    # 5. Store
    _progress("Storing in Neo4j...")
    db.upsert_document(doc_id, filename, {
        "num_chunks": len(chunks),
        "num_images": len(image_bytes_list),
        "filename": filename,
    })

    chunk_ids = []
    for idx, (text, emb) in enumerate(zip(chunks, embeddings)):
        chunk_id = f"{doc_id}_{idx}"
        db.upsert_chunk(
            chunk_id=chunk_id,
            doc_id=doc_id,
            text=text,
            embedding=emb,
            index=idx,
            metadata={"filename": filename, "chunk_index": idx},
        )
        chunk_ids.append(chunk_id)

    db.link_sequential_chunks(chunk_ids)

    _progress(f"Ingested {len(chunks)} chunks from '{filename}'")
    return {
        "doc_id": doc_id,
        "filename": filename,
        "chunks": len(chunks),
        "images_processed": len(image_bytes_list),
    }
