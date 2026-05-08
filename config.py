import os
from dotenv import load_dotenv

load_dotenv()

# Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.1")
VISION_MODEL = os.getenv("VISION_MODEL", "moondream")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")

# Chunking
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "60"))

# Retrieval
TOP_K_VECTOR = int(os.getenv("TOP_K_VECTOR", "5"))
GRAPH_HOP_DEPTH = int(os.getenv("GRAPH_HOP_DEPTH", "2"))

# Embedding dimensions for nomic-embed-text
EMBED_DIMS = 768
VECTOR_INDEX_NAME = "chunkIndex"
