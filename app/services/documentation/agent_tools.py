"""
Documentation agent tools for the OpenAI Agents SDK.

Tools provided:
  extract_entities         — query Neo4j for entity type distribution and key entities
  get_architecture_overview — query Neo4j for architectural layers and call graphs
  get_code_examples        — vector-search Qdrant for concrete code snippets on a topic
  doc_vector_search        — semantic search within the single source collection
  doc_graph_search         — knowledge-graph search scoped to the single source

Context is injected via RunContextWrapper[DocumentationAgentContext], which carries
source_id, collection_name, user_id, doc_gen_id, and config — no global state.

Client singletons (_qdrant, _embeddings, _neo4j) are imported from the existing
tools.py module to avoid duplicate instantiation.
"""

from dataclasses import dataclass, field
from typing import Optional

from agents import RunContextWrapper, function_tool
from langchain_qdrant import QdrantVectorStore

# ── Reuse singletons from chat agent tools (no duplicate instantiation) ──
from app.services.agents.tools import _qdrant, _embeddings, _neo4j, GRAPH_NODE_CAP

from app.utils.logger import logger


# ─────────────────────────────────────────────────────────────────────────
# Agent context
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class DocumentationAgentContext:
    """Context injected into every documentation agent tool call."""
    source_id: str        # GitHub source being documented (Neo4j scope key)
    collection_name: str  # Qdrant collection name for this source (vector search)
    user_id: str          # For logging / audit
    doc_gen_id: str       # For pipeline progress tracking
    config: dict          # Generation config: style, detail_level, model, etc.
    _vector_store_cache: dict = field(default_factory=dict, repr=False)

    def get_vector_store(self) -> QdrantVectorStore:
        """Return a cached QdrantVectorStore for this context's collection."""
        if self.collection_name not in self._vector_store_cache:
            self._vector_store_cache[self.collection_name] = QdrantVectorStore(
                client=_qdrant,
                collection_name=self.collection_name,
                embedding=_embeddings,
            )
        return self._vector_store_cache[self.collection_name]


# ─────────────────────────────────────────────────────────────────────────
# Tool 1 — Extract Entities
# ─────────────────────────────────────────────────────────────────────────

@function_tool
async def extract_entities(
    wrapper: RunContextWrapper[DocumentationAgentContext],
    entity_type: Optional[str] = None,
) -> str:
    """
    Extract all code entities from the knowledge graph for this repository.
    Use at the START of documentation generation to understand the full codebase structure.

    Returns an entity type distribution (Class: 15, Function: 42, Module: 8, …) and
    a list of the most important entities with their names and types.

    Args:
        entity_type: Optional filter — e.g. "Class", "Function", "Module", "File".
                     If omitted, returns ALL entity types and their counts.
    """
    ctx = wrapper.context
    try:
        if entity_type:
            result = _neo4j.query(
                """
                MATCH (e:Entity)
                WHERE e.source_id = $source_id
                  AND e.type = $entity_type
                RETURN e.name AS name, e.type AS type, e.description AS description
                ORDER BY e.name
                LIMIT 50
                """,
                {"source_id": ctx.source_id, "entity_type": entity_type},
            )
            if not result:
                return f"No entities of type '{entity_type}' found in the knowledge graph."
            lines = [f"Entities of type '{entity_type}' ({len(result)} found):"]
            for row in result:
                desc = f" — {row['description']}" if row.get("description") else ""
                lines.append(f"  • {row['name']}{desc}")
            return "\n".join(lines)

        # No filter → return distribution + top entities
        distribution = _neo4j.query(
            """
            MATCH (e:Entity)
            WHERE e.source_id = $source_id
            RETURN e.type AS type, count(*) AS count
            ORDER BY count DESC
            """,
            {"source_id": ctx.source_id},
        )
        top_entities = _neo4j.query(
            """
            MATCH (e:Entity)
            WHERE e.source_id = $source_id
            OPTIONAL MATCH (e)-[r]-()
            RETURN e.name AS name, e.type AS type, count(r) AS connections
            ORDER BY connections DESC
            LIMIT $cap
            """,
            {"source_id": ctx.source_id, "cap": GRAPH_NODE_CAP},
        )

        if not distribution and not top_entities:
            return (
                "No entities found in the knowledge graph for this source. "
                "The repository may not have been graph-indexed yet."
            )

        lines = ["=== Entity Distribution ==="]
        for row in distribution:
            lines.append(f"  {row['type']}: {row['count']}")

        lines.append("\n=== Most Connected Entities ===")
        for row in top_entities:
            lines.append(f"  {row['name']} ({row['type']}) — {row['connections']} connections")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[DocTool] extract_entities failed for source {ctx.source_id}: {e}")
        return f"Entity extraction failed: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Tool 2 — Architecture Overview
# ─────────────────────────────────────────────────────────────────────────

@function_tool
async def get_architecture_overview(
    wrapper: RunContextWrapper[DocumentationAgentContext],
) -> str:
    """
    Get a high-level architecture summary: modules, layers, critical dependencies,
    and key call chains for this repository.
    Use when you need to write the 'Architecture & Design' section of the documentation.
    """
    ctx = wrapper.context
    try:
        # Module-level groupings
        modules = _neo4j.query(
            """
            MATCH (e:Entity)
            WHERE e.source_id = $source_id AND e.type IN ['Module', 'File']
            RETURN e.name AS module, e.description AS description
            ORDER BY e.name
            LIMIT 30
            """,
            {"source_id": ctx.source_id},
        )

        # Critical dependency chains (high fan-in = depended on by many)
        dependencies = _neo4j.query(
            """
            MATCH (caller:Entity)-[r:CALLS|IMPORTS|DEPENDS_ON]->(callee:Entity)
            WHERE caller.source_id = $source_id AND callee.source_id = $source_id
            RETURN
                caller.name   AS caller,
                caller.type   AS caller_type,
                type(r)       AS relationship,
                callee.name   AS callee,
                callee.type   AS callee_type,
                count(*)      AS weight
            ORDER BY weight DESC
            LIMIT $cap
            """,
            {"source_id": ctx.source_id, "cap": GRAPH_NODE_CAP},
        )

        if not modules and not dependencies:
            return (
                "No architectural information found. "
                "Try using extract_entities to see what is in the knowledge graph."
            )

        lines = ["=== Modules / Files ==="]
        if modules:
            for row in modules:
                desc = f" — {row['description']}" if row.get("description") else ""
                lines.append(f"  • {row['module']}{desc}")
        else:
            lines.append("  (none found)")

        lines.append("\n=== Key Dependency Relationships ===")
        if dependencies:
            for row in dependencies:
                lines.append(
                    f"  {row['caller']} ({row['caller_type']}) "
                    f"--[{row['relationship']}]--> "
                    f"{row['callee']} ({row['callee_type']})"
                )
        else:
            lines.append("  (none found)")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[DocTool] get_architecture_overview failed for source {ctx.source_id}: {e}")
        return f"Architecture overview failed: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Tool 3 — Get Code Examples
# ─────────────────────────────────────────────────────────────────────────

@function_tool
async def get_code_examples(
    wrapper: RunContextWrapper[DocumentationAgentContext],
    topic: str,
    max_examples: int = 3,
) -> str:
    """
    Search the indexed repository files for real code examples related to a topic.
    Use when writing the 'Usage Examples' or 'API Reference' sections.

    Args:
        topic:        What to find examples for (e.g. "authentication", "database queries",
                      "API endpoints", "error handling").
        max_examples: Number of code snippets to return (default 3, max 5).
    """
    ctx = wrapper.context
    max_examples = min(max_examples, 5)

    try:
        vector_store = ctx.get_vector_store()
        docs = vector_store.similarity_search(
            f"code example for {topic}",
            k=max_examples,
        )

        if not docs:
            return f"No code examples found for '{topic}' in the repository."

        results = []
        for doc in docs:
            file_path = doc.metadata.get("path", doc.metadata.get("source", "unknown"))
            lang = _infer_language(file_path)
            results.append(
                f"**File**: `{file_path}`\n"
                f"```{lang}\n{doc.page_content.strip()}\n```"
            )

        return f"Code examples for '{topic}':\n\n" + "\n\n---\n\n".join(results)

    except Exception as e:
        logger.error(f"[DocTool] get_code_examples failed for source {ctx.source_id}: {e}")
        return f"Code example search failed: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Tool 4 — Vector Search (doc-scoped)
# ─────────────────────────────────────────────────────────────────────────

@function_tool
async def doc_vector_search(
    wrapper: RunContextWrapper[DocumentationAgentContext],
    query: str,
    top_k: int = 3,
) -> str:
    """
    Search the repository's indexed files using semantic similarity.
    Use for finding README content, setup instructions, inline documentation,
    configuration comments, or any prose content in the repository.

    Args:
        query: What to search for (natural language)
        top_k: Number of results (default 3, max 8)
    """
    ctx = wrapper.context
    top_k = min(top_k, 8)

    try:
        vector_store = ctx.get_vector_store()
        docs = vector_store.similarity_search(query, k=top_k)

        if not docs:
            return f"No content found for '{query}'."

        results = []
        for doc in docs:
            file_path = doc.metadata.get("path", doc.metadata.get("source", "unknown"))
            results.append(f"[{file_path}]\n{doc.page_content}")

        return "\n\n---\n\n".join(results)

    except Exception as e:
        logger.error(f"[DocTool] doc_vector_search failed for source {ctx.source_id}: {e}")
        return f"Vector search failed: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Tool 5 — Graph Search (doc-scoped)
# ─────────────────────────────────────────────────────────────────────────

@function_tool
async def doc_graph_search(
    wrapper: RunContextWrapper[DocumentationAgentContext],
    entity_name: str,
) -> str:
    """
    Search the knowledge graph for a specific entity and its relationships.
    Use when you need to understand how a class, function, or module
    connects to the rest of the codebase.

    IMPORTANT: Pass the entity NAME — not a question.
      ✓ "AuthService"    ✗ "how does authentication work?"
      ✓ "UserModel"      ✗ "what does the user model do?"

    Args:
        entity_name: The class, function, or module name to look up
    """
    ctx = wrapper.context

    try:
        result = _neo4j.query(
            """
            MATCH (e:Entity)
            WHERE toLower(e.name) CONTAINS toLower($entity_name)
              AND e.source_id = $source_id
            OPTIONAL MATCH (e)-[r]-(related:Entity)
            WHERE related.source_id = $source_id
            RETURN
                e.name        AS entity,
                e.type        AS entity_type,
                e.description AS description,
                type(r)       AS relationship,
                related.name  AS related_entity,
                related.type  AS related_type
            LIMIT $cap
            """,
            {
                "entity_name": entity_name,
                "source_id": ctx.source_id,
                "cap": GRAPH_NODE_CAP,
            },
        )

        if not result:
            return f"No entities found matching '{entity_name}' in the knowledge graph."

        lines = [f"Graph results for '{entity_name}':"]
        seen = set()
        for row in result:
            entity      = row.get("entity", "")
            entity_type = row.get("entity_type", "")
            description = row.get("description", "")
            rel         = row.get("relationship")
            related     = row.get("related_entity")
            related_type= row.get("related_type", "")

            if rel and related:
                line = f"  {entity} ({entity_type}) --[{rel}]--> {related} ({related_type})"
            else:
                line = f"  {entity} ({entity_type})"
                if description:
                    line += f" — {description}"

            if line not in seen:
                lines.append(line)
                seen.add(line)

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"[DocTool] doc_graph_search failed for source {ctx.source_id}: {e}")
        return f"Graph search failed: {str(e)}"


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _infer_language(file_path: str) -> str:
    """Infer a fenced-code-block language tag from a file extension."""
    ext_map = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".jsx": "jsx", ".tsx": "tsx", ".go": "go", ".rs": "rust",
        ".java": "java", ".kt": "kotlin", ".cs": "csharp",
        ".cpp": "cpp", ".c": "c", ".h": "c",
        ".yaml": "yaml", ".yml": "yaml",
        ".json": "json", ".toml": "toml", ".sh": "bash",
        ".md": "markdown", ".sql": "sql", ".html": "html", ".css": "css",
    }
    if "." in file_path:
        ext = "." + file_path.rsplit(".", 1)[-1].lower()
        return ext_map.get(ext, "")
    return ""
