# Innate-Env: Transforming Research with GraphRAG 

> **A deep-dive into building a Text-based Graph Retrieval-Augmented Generation system for complex medical data.**

Traditional RAG systems often struggle with "connecting the dots" across large datasets because they treat information as isolated chunks. **Innate-Env** solves this by leveraging **GraphRAG**—using structured knowledge graphs to capture the relationships between entities, ensuring that the AI understands the *context*, not just the keywords.

---

## The Motivation: Why GraphRAG?
While working with complex datasets, I realized that standard vector search often misses the global context. If a research paper mentions a "symptom" on page 5 and a "treatment" on page 50, a basic RAG might not link them effectively. 

**Innate-Env** was built to:
1. **Extract Entities:** Identify key terms and concepts automatically using LLMs.
2. **Map Relationships:** Create a network (graph) of how these entities interact.
3. **Enhance Retrieval:** Use the graph structure to provide the LLM with a comprehensive "map" of the data before it generates an answer.

---

## The Tech Stack
*   **Language:** Python 3.x
*   **Graph Database:** Neo4j (for high-performance relationship mapping)
*   **Orchestration:** LangChain / Indexing frameworks
*   **LLM Integration:** Optimized for Graph-based querying and Cypher generation.

---

## Technical Deep-Dive: How it Works
Unlike a standard flat index, this project implements a multi-stage pipeline:

### 1. Knowledge Graph Construction
The system parses raw text and uses an LLM to identify "Nodes" and "Edges". This transforms unstructured text into a structured web of knowledge, allowing for multi-hop reasoning.

### 2. Contextual Retrieval
When a user asks a question, the system doesn't just look for similar text; it traverses the graph. It finds the relevant node and explores its neighbors, gathering a rich context that a standard similarity search would overlook.

> **Key Insight:** During development, I found that the precision of the GraphRAG approach is significantly higher for "Global" questions compared to "Local" keyword-based questions.

---

##  Results & Impact
*   **Enhanced Connectivity:** Successfully mapped complex relationships within research notebooks.
*   **Improved Reasoning:** The LLM provides more structured, evidence-based answers by citing specific nodes in the knowledge graph.

---

##  Getting Started
To run this project locally, ensure you have a Neo4j instance running and follow these steps:

```bash
# Clone the repository
git clone [https://github.com/Giridhar083/Innate-Env-----GraphRAG](https://github.com/Giridhar083/Innate-Env-----GraphRAG)

# Install dependencies
pip install -r requirements.txt

# Configure your environment variables
export NEO4J_URI="your_uri"
export OPENAI_API_KEY="your_key"

# Launch the system
python main.py
GRAPH_DB_USER=neo4j
GRAPH_DB_PASSWORD=your_password

# API Configuration
API_PORT=3000
API_TIMEOUT=30000

# LLM Configuration
LLM_MODEL=gpt-4
LLM_API_KEY=your_api_key

# Environment
NODE_ENV=development
```

## Architecture

The system is built with a modular architecture:

- **Graph Layer**: Knowledge graph management and queries
- **Retrieval Layer**: Semantic search and ranking
- **Generation Layer**: LLM-based response generation
- **API Layer**: REST endpoints and request handling
- **Configuration Layer**: Environment management

```
┌─────────────────────────────────────────┐
│         API & Request Handler           │
├─────────────────────────────────────────┤
│    Retrieval Layer (Search & Rank)      │
├─────────────────────────────────────────┤
│  Generation Layer (LLM Integration)     │
├─────────────────────────────────────────┤
│      Graph Layer (DB Operations)        │
├─────────────────────────────────────────┤
│  Configuration & Environment Management │
└─────────────────────────────────────────┘
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow JavaScript/Node.js best practices
- Write tests for new features
- Update documentation accordingly
- Ensure code linting passes

---

**Last Updated**: May 8, 2026

For more information, visit the [GitHub repository](https://github.com/Giridhar083/Innate-Env-----GraphRAG).
