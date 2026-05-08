from neo4j import GraphDatabase, AsyncGraphDatabase
import asyncio
from config import (
    NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD,
    EMBED_DIMS, VECTOR_INDEX_NAME
)
import logging

logger = logging.getLogger(__name__)


class GraphDB:
    def __init__(self):
        self._driver = None

    def connect(self):
        self._driver = GraphDatabase.driver(
            NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD)
        )
        self._driver.verify_connectivity()
        logger.info("Connected to Neo4j")

    def close(self):
        if self._driver:
            self._driver.close()

    def setup_schema(self):
        with self._driver.session() as session:
            # Unique constraint on chunk id
            session.run("""
                CREATE CONSTRAINT chunk_id IF NOT EXISTS
                FOR (c:Chunk) REQUIRE c.id IS UNIQUE
            """)
            # Unique constraint on document id
            session.run("""
                CREATE CONSTRAINT doc_id IF NOT EXISTS
                FOR (d:Document) REQUIRE d.id IS UNIQUE
            """)
            # Vector index on Chunk embeddings
            try:
                session.run(f"""
                    CREATE VECTOR INDEX {VECTOR_INDEX_NAME} IF NOT EXISTS
                    FOR (c:Chunk) ON c.embedding
                    OPTIONS {{indexConfig: {{
                        `vector.dimensions`: {EMBED_DIMS},
                        `vector.similarity_function`: 'cosine'
                    }}}}
                """)
                logger.info("Vector index created/verified")
            except Exception as e:
                logger.warning(f"Vector index setup: {e}")

    # Document ingestion

    def upsert_document(self, doc_id: str, filename: str, metadata: dict):
        with self._driver.session() as session:
            session.run("""
                MERGE (d:Document {id: $id})
                SET d.filename = $filename,
                    d.metadata = $metadata,
                    d.created_at = timestamp()
            """, id=doc_id, filename=filename, metadata=str(metadata))

    def upsert_chunk(self, chunk_id: str, doc_id: str, text: str,
                     embedding: list[float], index: int, metadata: dict = None):
        with self._driver.session() as session:
            session.run("""
                MERGE (c:Chunk {id: $id})
                SET c.text = $text,
                    c.embedding = $embedding,
                    c.index = $index,
                    c.doc_id = $doc_id,
                    c.metadata = $metadata
                WITH c
                MATCH (d:Document {id: $doc_id})
                MERGE (d)-[:HAS_CHUNK]->(c)
            """, id=chunk_id, text=text, embedding=embedding,
                index=index, doc_id=doc_id, metadata=str(metadata or {}))

    def link_sequential_chunks(self, chunk_ids: list[str]):
        with self._driver.session() as session:
            for i in range(len(chunk_ids) - 1):
                session.run("""
                    MATCH (a:Chunk {id: $a_id}), (b:Chunk {id: $b_id})
                    MERGE (a)-[:NEXT_CHUNK]->(b)
                """, a_id=chunk_ids[i], b_id=chunk_ids[i + 1])

    #GraphRAG Retrieval

    def text_search(self, query: str, top_k: int = 5) -> list[dict]:
        # Split query into words for matching
        keywords = [w.lower() for w in query.split() if len(w) > 3]
        if not keywords:
            keywords = query.lower().split()

        with self._driver.session() as session:
            # Use CONTAINS for basic text matching
            conditions = " OR ".join([f"toLower(c.text) CONTAINS '{kw}'" for kw in keywords[:5]])
            result = session.run(f"""
                MATCH (c:Chunk)
                WHERE {conditions}
                RETURN c.id AS id, c.text AS text,
                       c.doc_id AS doc_id, c.index AS idx,
                       0.5 AS score
                LIMIT $top_k
            """, top_k=top_k)
            return [dict(r) for r in result]

    def get_all_chunks(self, top_k: int = 5) -> list[dict]:
        with self._driver.session() as session:
            result = session.run("""
                MATCH (c:Chunk)
                RETURN c.id AS id, c.text AS text,
                       c.doc_id AS doc_id, c.index AS idx
                ORDER BY c.doc_id, c.index
                LIMIT $top_k
            """, top_k=top_k)
            return [dict(r) for r in result]

    def vector_search(self, query_embedding: list[float], top_k: int = 5) -> list[dict]:
        with self._driver.session() as session:
            result = session.run(f"""
                CALL db.index.vector.queryNodes(
                    '{VECTOR_INDEX_NAME}', $top_k, $embedding
                ) YIELD node AS c, score
                RETURN c.id AS id, c.text AS text,
                       c.doc_id AS doc_id, c.index AS idx, score
                ORDER BY score DESC
            """, top_k=top_k, embedding=query_embedding)
            return [dict(r) for r in result]

    def graph_expand(self, chunk_ids: list[str], hop_depth: int = 2) -> list[dict]:
        with self._driver.session() as session:
            result = session.run("""
                UNWIND $chunk_ids AS seed_id
                MATCH (seed:Chunk {id: seed_id})
                // Forward chain
                OPTIONAL MATCH (seed)-[:NEXT_CHUNK*1..$depth]->(fwd:Chunk)
                // Backward chain
                OPTIONAL MATCH (bwd:Chunk)-[:NEXT_CHUNK*1..$depth]->(seed)
                WITH collect(DISTINCT seed) + collect(DISTINCT fwd)
                     + collect(DISTINCT bwd) AS all_chunks
                UNWIND all_chunks AS c
                WHERE c IS NOT NULL
                RETURN DISTINCT c.id AS id, c.text AS text,
                       c.doc_id AS doc_id, c.index AS idx
                ORDER BY c.doc_id, c.index
            """, chunk_ids=chunk_ids, depth=hop_depth)
            return [dict(r) for r in result]

    # Statistics

    def get_stats(self) -> dict:
        with self._driver.session() as session:
            r = session.run("""
                MATCH (d:Document) WITH count(d) AS docs
                MATCH (c:Chunk)    WITH docs, count(c) AS chunks
                MATCH ()-[r:NEXT_CHUNK]->() WITH docs, chunks, count(r) AS edges
                RETURN docs, chunks, edges
            """).single()
            return dict(r) if r else {"docs": 0, "chunks": 0, "edges": 0}

    def list_documents(self) -> list[dict]:
        with self._driver.session() as session:
            result = session.run("""
                MATCH (d:Document)
                OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
                RETURN d.id AS id, d.filename AS filename,
                       count(c) AS chunk_count, d.created_at AS created_at
                ORDER BY d.created_at DESC
            """)
            return [dict(r) for r in result]

    def delete_document(self, doc_id: str):
        with self._driver.session() as session:
            session.run("""
                MATCH (d:Document {id: $doc_id})
                OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
                DETACH DELETE d, c
            """, doc_id=doc_id)


# Singleton
db = GraphDB()