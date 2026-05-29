# GraphLM — Knowledge Transfer Document (V2)

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependency Architecture](#2-tech-stack--dependency-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Architecture & Request Lifecycle](#4-architecture--request-lifecycle)
5. [Database Schema (SQLAlchemy Models)](#5-database-schema-sqlalchemy-models)
6. [Backend — API Routes Reference](#6-backend--api-routes-reference)
7. [Indexing Pipeline](#7-indexing-pipeline)
8. [Agent Pipeline & Scoping](#8-agent-pipeline--scoping)
9. [Context Window Management & Compaction](#9-context-window-management--compaction)
10. [Real-Time Features (SSE & LISTEN/NOTIFY)](#10-real-time-features-sse--listennotify)
11. [Authentication, Security & Flow Enhancements](#11-authentication-security--flow-enhancements)
12. [Frontend Architecture & Components](#12-frontend-architecture--components)
13. [Configuration Reference (.env)](#13-configuration-reference-env)
14. [Running the Project (Step-by-Step)](#14-running-the-project-step-by-step)
15. [Key Design Decisions & Rationale](#15-key-design-decisions--rationale)

---

## 1. Project Overview

**GraphLM** is a full-stack AI research assistant designed to index, query, and reason over user-provided knowledge sources. Users can upload standard text documents (PDF, DOCX, TXT, MD) or ingest entire GitHub repositories. 

The application builds a dual knowledge store for uploaded sources:
1. **Vector Database (Qdrant):** Used for standard semantic search and vector retrieval.
2. **Knowledge Graph (Neo4j):** Used to extract, model, and traverse entities and relationships.

When chatting, the AI agent dynamically queries both Qdrant and Neo4j in real time, combining unstructured context with structural relationships to yield highly precise answers. 

* **Name Origin:** **Graph** (Knowledge Graph) + **LM** (Language Model).
* **Context:** GraphLM is a Bachelor of Engineering (BE) Final Exam project, Semester 8, AISSMS IOIT.

---

## 2. Tech Stack & Dependency Architecture

### Backend Stack
| Category | Technology / Library | Details |
|---|---|---|
| **Framework** | FastAPI + Uvicorn | High-performance asynchronous API layer. |
| **Language** | Python 3.13 / 3.11+ | Python type hinting and modern constructs. |
| **ORM** | SQLAlchemy (sync) | Object Relational Mapping for Postgres. |
| **Migrations** | Alembic | Database schema migrations + enum handling. |
| **Auth** | JWT (python-jose) + bcrypt | Stateless authentication & secure hashing. |
| **Rate Limiting** | slowapi | Limits endpoints to prevent abuse (NoOp in dev). |
| **Real-time** | PostgreSQL LISTEN/NOTIFY | Via `asyncpg` listener for streaming events. |
| **WS Engine** | `wsproto` | Eliminates legacy `websockets.legacy` deprecation warnings. |

> [!IMPORTANT]
> **Modularized Dependencies:** Backend dependencies have been split into two files to prevent RAM exhaustion and installation timeouts on lower-spec machines/WSL:
> * `requirements.txt`: Lightweight core server dependencies (FastAPI, SQLAlchemy, Uvicorn, auth tools).
> * `requirements-ai.txt`: Heavy AI, RAG, and database-specific libraries (LangChain, OpenAI Agents SDK, Mem0, Qdrant client, Neo4j driver).

### AI & Indexing Stack
| Category | Technology | Purpose |
|---|---|---|
| **LLM Engine** | OpenAI (`gpt-4o-mini` by default) | Core reasoning, graph construction, and chat. |
| **Embeddings** | OpenAI (`text-embedding-3-small`) | Embeds document chunks and user messages. |
| **Agent SDK** | OpenAI Agents SDK (`openai-agents`) | Running orchestrator and tool execution. |
| **Vector Database** | Qdrant | Fast vector indexing and semantic retrieval. |
| **Graph Database** | Neo4j (with APOC plugin) | Entity/relationship traversal and subgraph scoping. |
| **Graph Builder** | LangChain `LLMGraphTransformer` | Experimental utility to convert raw text into graph tuples. |
| **User Memory** | Mem0 (`mem0ai` cloud API) | Person-scoped long-term memory. |
| **RAG framework** | LangChain + langchain-qdrant + langchain-neo4j | Connectors and tooling. |

### External Services
* **Cloudinary:** Remote storage for document backups and custom user profile avatars.
* **Mailtrap:** SMTP sandbox used for user email verification and password resets.
* **GitHub OAuth:** Allows social login and ingesting private/public GitHub repositories.

### Frontend Stack
| Category | Technology | Details |
|---|---|---|
| **Framework** | React 19 + Vite 7 | Modern React rendering and fast dev builds. |
| **Styling** | TailwindCSS 4 | Migrated to modern **Tailwind v4** with HSL theme variables. |
| **State** | Zustand 5 | Light, responsive store-based state management. |
| **Routing** | React Router 7 | Client-side routing, protected routes, and layouts. |
| **Visualizations** | `vis-network` + `vis-data` | Direct Canvas rendering of knowledge graphs. |
| **Markdown** | `react-markdown` + `remark-gfm` | Formatted streaming answers with tables and codes. |
| **Toasts** | `sonner` | Toast notification center. |
| **HTTP client** | Axios | Modularized service modules per resource. |

---

## 3. Repository Structure

```
graphlm-fastapi/
├── app/
│   ├── api/
│   │   ├── routes/           # Route handlers (auth, users, sessions, sources, health)
│   │   ├── deps.py           # Dependency injectors (get_db, get_current_user, etc.)
│   │   └── limiter.py        # Rate limiting configuration (NoOpLimiter in dev)
│   ├── core/
│   │   ├── config.py         # Pydantic Settings, Neo4j connection lifecycle
│   │   ├── error_codes.py    # Standard application-level error codes
│   │   └── security.py       # JWT creation, decryption, password hashing
│   ├── db/
│   │   ├── database.py       # SQLAlchemy engine, Base class, get_db session generator
│   │   ├── session.py        # get_db_session() context manager for background tasks
│   │   ├── base.py           # Core metadata registry imports
│   │   ├── listeners/        # Async listening logic for PostgreSQL channels
│   │   └── sql/              # Raw SQL triggers for real-time progress updates
│   ├── models/               # SQLAlchemy models (User, Source, SourceIndex, etc.)
│   ├── repositories/         # DB query helpers (user_repo, session_repo, source_repo)
│   ├── schemas/              # Pydantic request/response schemas
│   ├── services/
│   │   ├── agents/           # AI orchestrator & agent tools
│   │   │   ├── chat_agent.py         # OpenAI Agents SDK setup and SSE streams
│   │   │   ├── graph_query_agent.py  # Native natural-language Cypher queries
│   │   │   ├── pipeline.py           # Context assembly + agent execution pipeline
│   │   │   ├── tools.py              # Tool definitions (vector_search, graph_search, mem0)
│   │   │   ├── context/              # Rolling summary context window manager
│   │   │   └── streaming/            # Custom Server-Sent Events stream formatter
│   │   ├── indexing/
│   │   │   ├── pipeline.py     # Two-phase indexing coordinator (Vector first, then Graph)
│   │   │   ├── ingestion.py    # Document loading, parsing, and chunking
│   │   │   ├── vector_index.py # Qdrant collection creation and embedding
│   │   │   └── graph_index.py  # Neo4j graph population via LLM extraction
│   │   ├── auth_service.py
│   │   ├── cloudinary_service.py
│   │   ├── github_oauth_service.py
│   │   └── health_service.py
│   ├── templates/email/      # Jinja2 templates (verification & password reset)
│   ├── utils/                # Utility modules (logging, custom exceptions, etc.)
│   │   ├── logger.py         # Unified colorized UvicornStyleFormatter logging system
│   │   ├── user_utils.py     # UI Avatars generator and secure public serializer
│   │   └── db_queries.py     # Resource ownership verification utilities
│   └── main.py               # FastAPI core entrypoint, middleware, and routers
├── frontend/
│   ├── public/               # Static assets
│   │   └── logo/             # Standard SVG GraphLM logos (light, dark, icon)
│   ├── src/
│   │   ├── api/              # Axios service endpoints
│   │   ├── Components/       # Reusable UI components
│   │   │   ├── Auth/         # AuthShell layout wrapper + ProtectedRoute HOC
│   │   │   ├── Chat/         # ChatPanel, SourcesPanel, StudioPanel, GraphView (Canvas)
│   │   │   ├── Common/       # GraphLMLogo (theme-aware SVG)
│   │   │   ├── Theme/        # ThemeToggleButton
│   │   │   └── Layout/       # Header, Sidebar, Footer components
│   │   ├── pages/            # Page-level route views (Landing, Chat, Dashboard, Auth)
│   │   ├── store/            # Zustand stores (auth, chat, source, themeStore)
│   │   ├── routes/           # Protected/Public Router configuration
│   │   └── index.css         # Tailwind v4 configuration and global tokens
│   ├── package.json
│   └── vite.config.js
├── migrations/               # Alembic database migrations
├── docker-compose.yml        # Multi-container local infrastructure (Postgres, Qdrant, Neo4j)
├── requirements.txt          # Primary backend python dependencies
├── requirements-ai.txt       # Split AI/RAG heavy dependencies
├── alembic.ini               # Alembic CLI configuration
└── .env.sample               # Environment variables template
```

---

## 4. Architecture & Request Lifecycle

```
                         ┌─────────────────────────────────┐
                         │        React Frontend           │
                         │ (Tailwind v4, Zustand, Canvas)  │
                         └────────────┬────────────────────┘
                                      │ HTTP / SSE
                         ┌────────────▼────────────────────┐
                         │      FastAPI Backend            │
                         │   (Unified Uvicorn Logs)        │
                         │                                 │
                         │  ┌──────────┐  ┌────────────┐  │
                         │  │  Routes  │  │  Services  │  │
                         │  └────┬─────┘  └─────┬──────┘  │
                         └───────┼──────────────┼─────────┘
                                 │              │
               ┌──────────────────┼──────────────┼───────────────────┐
               │                  │              │                   │
    ┌──────────▼───┐  ┌───────────▼──┐  ┌───────▼──────┐  ┌────────▼──────┐
    │  PostgreSQL  │  │    Qdrant    │  │    Neo4j     │  │     Mem0      │
    │  (port 5433) │  │ (port 6333)  │  │ (port 7687)  │  │  (cloud API)  │
    │  Primary DB  │  │ Vector Store │  │ Graph Store  │  │ Long-term Mem │
    └──────────────┘  └──────────────┘  └──────────────┘  └───────────────┘
```

### Chat Request Lifecycle

1. **User Sends Message:** The frontend triggers `POST /sessions/{id}/messages` containing the text and UI configuration (e.g., source selection, `subgraph_mode`).
2. **Postgres Persistence:** The user's message is validated and committed to PostgreSQL immediately to prevent history loss.
3. **Session Context Assembly:** A short database transaction is opened to:
   * Resolve active collection scopes and source IDs attached to the session.
   * Assemble the rolling conversation window using past transcript, rolling summary, and available token budget.
4. **Connection Release:** The database transaction is closed and its pool connection returned. **No open database connections are held during the LLM inference phase.**
5. **Agent Inference:** An instance of the OpenAI Agents SDK is constructed. The agent executes tool calls (vector searches, entity traversals, Mem0 facts retrieval) based on user prompt.
6. **SSE Streaming:** Server-Sent Events are formatted and pushed back to the client, yielding pipeline progress logs, tool details, actual response tokens, and updated subgraph visualization nodes in real time.
7. **Assistant Persistence:** Upon generation completion, the assistant message is written to PostgreSQL.
8. **Asynchronous Vector Ingestion:** A non-blocking background task embeds the new exchange (`user` and `assistant` messages) into the Qdrant index for the chat session's personal history.

---

## 5. Database Schema (SQLAlchemy Models)

### Core Models

#### **User** (`users` table)
* `id` (`UUID` PK) — Auto-generated v4 UUID.
* `fullname` (`String` nullable) — User's display name. Used for dynamic initials avatar generation.
* `username` (`String` unique, indexed) — User's custom handle.
* `email` (`String` unique, indexed) — Primary user identifier.
* `hashed_password` (`String` nullable) — Passlib-encrypted hash (nullable for social logins).
* `avatar` (`JSON` default) — Dict containing profile picture information: `{"url": "...", "public_id": ""}`. Defaults to `ui-avatars.com` initials URL.
* `google_id` (`String` unique, nullable) — Connected Google credential indicator.
* `github_id` (`String` unique, nullable) — Connected GitHub profile ID.
* `auth_provider` (`String` default "local") — Auth method indicator.
* `role` (`Enum[UserRole]` default "user") — Permissions level: `admin` | `user`.
* `is_email_verified` (`Boolean` default False) — Mail verification flag.
* `forgot_password_token` (`String` nullable) — Temp password reset token.
* `forgot_password_token_expiry` (`DateTime` nullable) — Token lifecycle tracker.
* `email_verification_token` (`String` nullable) — Temp email validation token.
* `email_verification_token_expiry` (`DateTime` nullable) — Token lifecycle tracker.
* `refresh_token` (`String` nullable) — Long-term session refresh token.
* `created_at` / `updated_at` (`DateTime`).

#### **Source** (`sources` table)
* `id` (`UUID` PK).
* `user_id` (`UUID` FK → `users.id`, ondelete="CASCADE").
* `title` (`String` nullable=False) — Document filename or repository name.
* `type` (`Enum[SourceType]`) — Source category: `document` | `github`.
* `status` (`Enum[SourceStatus]` default "uploaded") — Current state of indexing: `uploaded` | `indexing` | `indexed` | `failed`.
* `source_metadata` (mapped as `"metadata"`, `JSON`) — Holds configuration metadata (e.g., `file_size`, `cloudinary_url`, `branch`, `repo_url`).
* `created_at` (`DateTime`).

#### **SourceIndex** (`source_indexes` table) — *1:1 Relationship with Source*
* `id` (`UUID` PK).
* `source_id` (`UUID` FK → `sources.id`, ondelete="CASCADE", unique=True).
* `collection_name` (`String`) — Associated vector collection name in Qdrant (`document_{uuid}` or `github_{uuid}`).
* `vector_indexed` (`Boolean` default False) — Set True when vector upload completes.
* `vector_indexed_at` (`DateTime` nullable).
* `graph_indexed` (`Boolean` default False) — Set True when Neo4j nodes/edges construction completes.
* `graph_indexed_at` (`DateTime` nullable).
* `entity_count` / `relation_count` (`Integer` nullable) — Graph density metrics.
* `error_message` (`String` nullable) — Captures descriptive error if vector or graph indexing breaks.
* `provider` (`String` default "qdrant+neo4j").
* `embedding_model` (`String` default "text-embedding-3-small").
* `chunk_size` (`Integer` default 1000) / `chunk_overlap` (`Integer` default 200).

#### **ChatSession** (`chat_sessions` table)
* `id` (`UUID` PK).
* `user_id` (`UUID` FK → `users.id`, ondelete="CASCADE").
* `title` (`String` nullable=False).
* `created_at` (`DateTime`).
* `rolling_summary` (`Text` nullable) — LLM-compressed summary of earlier compacted conversation.
* `last_compacted_message_id` (`UUID` FK → `chat_messages.id`, ondelete="SET NULL") — Boundary marker for compaction.
* `needs_compaction` (`Boolean` default False).
* `last_compacted_at` (`DateTime` nullable).
* `recent_window_size` (`Integer` default 20).
* `estimated_token_usage` (`Integer` default 0).
* `compaction_threshold` (`Float` default 0.85).

#### **ChatMessage** (`chat_messages` table)
* `id` (`UUID` PK).
* `chat_id` (`UUID` FK → `chat_sessions.id`, ondelete="CASCADE").
* `role` (`Enum[MessageRole]`) — Participant role: `user` | `assistant` | `system`.
* `content` (`Text` nullable=False).
* `created_at` (`DateTime`).

### Relationship Architecture

```
User ──< Source ──1 SourceIndex
User ──< ChatSession >──< Source   (Many-to-Many via chat_session_sources)
ChatSession ──< ChatMessage
```

---

## 6. Backend — API Routes Reference

All standard responses are serialized to follow a consistent JSON format:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Descriptive success string",
  "data": { ... }
}
```

### Authentication — `/auth`
* `POST /auth/register` — Standard email-based signup. Issues custom avatar with user initials.
* `POST /auth/login` — Sign in with password, returns standard JWT and refresh tokens.
* `POST /auth/refresh` — Standard rotation of access token via secure refresh token.
* `POST /auth/logout` — Destroys refresh token record in the DB.
* `GET /auth/verify-email` — Confirms user verification token.
* `POST /auth/forgot-password` — Issues unique recovery link via Mailtrap.
* `POST /auth/reset-password` — Updates password if verification token passes.
* `GET /auth/github` — Starts GitHub OAuth redirect handoff.
* `GET /auth/github/callback` — GitHub OAuth callback and token issuance.

### Users — `/users`
* `GET /users/me` — Fetches verified profile metadata.
* `PATCH /users/me` — Updates user metadata (username, fullname, etc.).
* `POST /users/me/avatar` — Uploads and binds profile pictures in Cloudinary.
* `DELETE /users/me/avatar` — Replaces custom avatar with the fallback initials avatar.

### Chat Sessions — `/sessions`
* `POST /sessions/` — Starts a clean conversation workspace. (Rate: 5/min)
* `GET /sessions/` — Returns paginated history list of active user chat sessions. (Rate: 20/min)
* `GET /sessions/{id}` — Fetches chat session details, including attached sources. (Rate: 20/min)
* `PATCH /sessions/{id}/title` — Renames session title. (Rate: 5/min)
* `DELETE /sessions/{id}` — Permanently deletes session, cascades messages, and removes chat Qdrant collection as a background task. (Rate: 5/min)
* `PATCH /sessions/{id}/sources` — Attaches new knowledge sources (only if message count is zero). (Rate: 5/min)
* `DELETE /sessions/{id}/sources/{src_id}` — Detaches knowledge source (only if message count is zero; must have at least one remaining source). (Rate: 5/min)
* `POST /sessions/{id}/messages` — Feeds user prompt into Agent. Yields streaming SSE response. (Rate: 5/min)
* `GET /sessions/{id}/messages` — Paginated exchange log (default 50 per page, max 100). (Rate: 20/min)
* `POST /sessions/{id}/graph/query` — Natural language Cypher query agent interface. Supports optional `source_ids` scoping. (Rate: 5/min)
* `GET /sessions/{id}/graph` — Returns session's full static graph structure (capped at 500 nodes). (Rate: 20/min)
* `GET /sessions/{id}/context/state` — Retrieves rolling context window metrics (token usage, threshold, compaction status). (Rate: 20/min)
* `POST /sessions/{id}/context/evaluate` — Evaluates whether compaction is needed; marks `needs_compaction=True` if threshold exceeded. (Rate: 10/min)
* `POST /sessions/{id}/context/compact` — Manually triggers rolling summary compaction. (Rate: 5/min)
* `GET /sessions/{id}/context/summary` — Returns the current rolling summary text and metadata. (Rate: 20/min)
* `POST /sessions/{id}/context/rebuild` — **Admin only.** Recomputes context state from raw transcript. (Rate: 2/min)

### Sources — `/sources`
* `POST /sources/upload` — Multipart file upload (PDF, DOCX, TXT, MD, TEXT, MARKDOWN). Spawns background indexing pipeline. Returns 202. (Rate: 5/min)
* `POST /sources/github` — Ingests a public/private GitHub repository. Validates `github.com` URL. Returns 202. (Rate: 5/min)
* `GET /sources/` — Returns paginated list of sources (default 10/page, max 100). (Rate: 20/min)
* `GET /sources/{id}` — Returns detailed metadata for a single source. (Rate: 20/min)
* `GET /sources/{id}/status` — SSE endpoint streaming live indexing progress (snapshot → changes → complete). (Rate: 10/min)
* `DELETE /sources/{id}` — Deletes source. Cleans up Qdrant collection, Neo4j nodes, and Cloudinary backup. Fails with 500 if Qdrant or Neo4j cleanup fails. (Rate: 5/min)

---

## 7. Indexing Pipeline

The indexing engine resides in `app/services/indexing/`. It operates via a robust background task setup.

```
       Upload File / Add Repo
                 │
                 ▼
     Create DB Source Record
     Set status = "indexing"
                 │
                 ▼
  [Spawns Background Pipeline] ──────► 202 Accepted Response
                 │
                 ▼
 ┌───────────────────────────────┐
 │ Ingestion: Parse & Chunk      │
 └──────────────┬────────────────┘
                │
                ▼
 ┌───────────────────────────────┐
 │ Vector Ingest (Blocking Phase)│ ──► Success: Set Source "indexed"
 └──────────────┬────────────────┘     Chat is unblocked immediately!
                │
                ▼
 ┌───────────────────────────────┐
 │ Graph Ingest (Async Phase)    │ ──► Non-fatal: Failures do not
 └───────────────────────────────┘     impair vector-based chatting.
```

### Core Pipeline Phases

#### 1. Parse & Ingestion (`ingestion.py`)
* **Files:** Extracted using specific parser utilities (`PyPDFLoader` for PDF, `Docx2txtLoader` for DOCX, `TextLoader` for TXT/MD).
* **GitHub Repositories:** Ingested using `GithubFileLoader`. Excludes non-text files and binary blobs, checking custom file extensions.
* **Splitting:** Chunks are formatted using `RecursiveCharacterTextSplitter` (default size: 1000 characters, overlap: 200).

#### 2. Vector Indexing (`vector_index.py`) — *Blocking / Critical*
* Creates a unique collection in Qdrant: `{source_type}_{source_id}`.
* Generates embeddings with `text-embedding-3-small` in batches.
* Populates vector store alongside chunk payload.
* **Safety:** If vector generation fails, the source is marked as `failed`, resources are released, and the pipeline terminates. Vector indexing is required before chatting is permitted.

#### 3. Graph Ingestion (`graph_index.py`) — *Asynchronous / Non-Fatal*
* Iterates over chunks using `LLMGraphTransformer` with standard LLM schema.
* Extracts structured nodes (entities) and edges (relations).
* Generates Neo4j nodes/edges. Writes a persistent `source_id` property on every node to guarantee strict session scoping.
* **Safety:** If graph construction times out or breaks, the source status remains `indexed`. Neo4j issues do not block vector chatting.

### Deletion Lifecycle
When deleting a source, the cleanup task ensures no data leaks remain:
1. Deletes the personal Qdrant collection.
2. Runs Cypher query to detach and delete all Neo4j nodes matching `source_id`.
3. Cascades and deletes `SourceIndex` and `Source` tables.
4. Removes Cloudinary file backup.

---

## 8. Agent Pipeline & Scoping

The AI reasoning loop is contained in `app/services/agents/`.

### Core Agent Tools

| Tool | Parameters | Functionality |
|---|---|---|
| `vector_search` | `query: str`, `top_k: int=5` | Performs cosine similarity search across all Qdrant collections for attached sources. Returns text passages with source references. |
| `graph_search` | `entity_name: str` | Searches Neo4j for a matching entity name using case-insensitive `CONTAINS`. Returns 1-hop relationship results (capped at 25 rows). |
| `search_memory` | `query: str` | Queries user's personal long-term memory via Mem0 cloud API. |
| `save_memory` | `fact: str` | Saves a new fact to Mem0 memory store (called at agent's discretion, not every turn). |
| `update_memory` | `memory_id: str, new_fact: str` | Modifies an existing Mem0 record by its ID. |
| `delete_memory` | `memory_id: str` | Deletes a Mem0 record by its ID. |
| `subgraph_query` | `query: str` | Retrieves a JSON subgraph for visual panel update. Only active when `subgraph_mode=True`. The return value is detected by the streaming handler and re-emitted as a `graph_update` SSE event. |

> [!TIP]
> **Single Writer Memory Constraint:** The Agent is the exclusive writer to Mem0 (via the `save_memory` tool). No other parts of the application write to Mem0. This prevents duplicate memory entries and memory bloat.

### Agent Routing and Execution Loop (`chat_agent.py`)
* The application builds a clean, stateless instance of `Agent[AgentPromptContext]` for every incoming chat message request.
* The system prompt is built dynamically with active workspace configuration: which vector collections to query, active source IDs, user details, and whether `subgraph_mode` is enabled.
* **Streaming (`run_agent_stream`):** Outputs a formatted tuple sequence of `(event_type, payload)` yielding pipeline logs, tool names, tool execution results, raw text chunks, and final graph visualization nodes.

### Active Subgraph Scoping
When the user toggles the Graph Studio panel in the frontend:
* The client passes `subgraph_mode=True` with the message request.
* The backend enables the `subgraph_query` tool.
* The system prompt instructs the agent to call `subgraph_query` in parallel with RAG tools.
* **Source Scoping:** The `subgraph_query` tool strictly limits its Cypher extraction to the intersection of the session's graph-indexed source IDs and any user-selected focus sources. This ensures the visual graph remains relevant and scoped to active documents.

---

## 9. Context Window Management & Compaction

Located in `app/services/agents/context/`.

As a conversation grows, passing the entire history to the LLM will exceed its context window or increase latency. GraphLM implements a rolling conversation runtime inspired by Claude's compaction approach.

```
       Load Context State (Summary + last N messages)
                            │
                            ▼
                Estimate Current Token Budget
                            │
                            ▼
           Does usage exceed Compaction Threshold (85%)?
                 ├──► YES: Mark session "needs_compaction = True"
                 │         (Compaction runs in background task)
                 └──► NO:  Continue normally
                            │
                            ▼
         Assemble Final Context List for LLM Inference
```

### Compaction Execution (`summarizer.py`)
When `needs_compaction` is triggered or run manually (`POST /sessions/{id}/context/compact`):
1. Loads all chat messages preceding the compaction boundary.
2. Invokes an LLM compilation task to generate/update the rolling summary.
3. Overwrites `ChatSession.rolling_summary` with the new summary.
4. Updates `last_compacted_message_id` to point to the latest compacted message.
5. Sets `needs_compaction = False`.

### Budget Constraints & Configuration
```python
MODEL_MAX_TOKENS         = 120000    # Default context budget
CONTEXT_SAFE_RATIO       = 0.75      # Safe maximum ratio (75% -> 90,000 tokens)
CONTEXT_RESERVED_FOR_RAG = 15000     # Reserved headroom for vector/graph RAG chunks
CONTEXT_RESERVED_FOR_RESPONSE = 5000 # Headroom for agent generation
SYSTEM_PROMPT_BUDGET     = 1000      # Headroom for prompt & tool specifications
CONTEXT_KEEP_RECENT      = 6         # Minimum number of recent messages kept verbatim
COMPACTION_THRESHOLD     = 0.85      # Compact at 85% of budget
COMPACTION_TARGET_RATIO  = 0.50      # Target post-compaction size (50%)
```

---

## 10. Real-Time Features (SSE & LISTEN/NOTIFY)

### 1. Ingestion Progress Stream (`GET /sources/{id}/status`)
The frontend needs to show real-time progress while documents are parsed and indexed. GraphLM uses a reactive listener architecture:
* When a source starts indexing, the client opens an `EventSource` connection.
* The backend registers an `asyncio.Queue` linked to `source_id` in `SourceStatusListener`.
* PostgreSQL triggers fire `NOTIFY source_status_channel` with JSON payloads whenever `sources` or `source_indexes` rows update.
* An `asyncpg` listener captures the notification and routes it to the corresponding queue.
* **Lifecycle:** The SSE connection is kept open until both vector and graph indexing are complete (`vector_indexed` is True AND `graph_indexed` is either True or failed).
* **Heartbeats:** Sends an empty comment line (`: heartbeat`) every 20 seconds to prevent network proxy timeouts.

### 2. Chat Stream (`POST /sessions/{id}/messages`)
Returns a `StreamingResponse` using a plain-text token stream:
* `[PIPELINE] ...` — Logs backend context-building stages.
* `[TOOL] name:args` — Yields active tool calls.
* `[TOOL_OUTPUT] name:result` — Logs completed tool execution.
* Raw text tokens — Streamed directly as they generate.
* `[GRAPH_NODES] ...` — Streams visual nodes/edges to update the canvas.
* `[DONE]` — Signals successful completion.
* `[ERROR] msg` — Signals pipeline failures.

---

## 11. Authentication, Security & Flow Enhancements

### JWT Security Lifecycle
* **Access Tokens:** Short-lived (default 15 hours), returned in the JSON payload, and stored in the client's `localStorage`.
* **Refresh Tokens:** Long-lived (7 days), stored securely in the database (`User.refresh_token`). Handled via rotation endpoints.

### Verification and Recovery Flows
* **Double-Opt Verification:** Standard signup issues a verification email. Users must confirm via their email link to activate full session capabilities.
* **Reset Password:** Requests issue a short-lived recovery token via Mailtrap.
* **Security Enhancement:** Form screens (Login, Signup, and Reset Password) feature password visibility toggles to improve accuracy during input.

### Resource Ownership Checks
To prevent ID-guessing attacks, endpoints that mutate resources call `verify_ownership`:
```python
# app/utils/db_queries.py
def verify_ownership(resource_owner_id, current_user_id, resource_name):
    if resource_owner_id != current_user_id:
        raise ApiError(status_code=403, error_code="FORBIDDEN", message=f"You do not own this {resource_name}")
```

### Rate Limiting
Configured via `slowapi`. Uses a `NoOpLimiter` in development.
* `5/minute` — High-cost operations: `POST /messages`, `/upload`, `/github`, source deletions.
* `10/minute` — Medium-cost operations: compact evaluations, status checks.
* `20/minute` — Low-cost operations: fetching lists, profiles, dashboard queries.

---

## 12. Frontend Architecture & Components

The frontend is built with React 19, Vite 7, and TailwindCSS v4. It features a responsive layout designed for developer usability.

### Core Routing and Views
| Route | Page | Notes |
|---|---|---|
| `/` | `Landing` | Marketing page |
| `/auth` | `AuthPage` | Login/Register — controlled by `?mode=login\|register` query param |
| `/login` | — | Redirect alias → `/auth?mode=login` |
| `/auth/verify` | `VerifyEmailPage` | Email verification in-progress |
| `/email-verified` | `EmailVerifiedPage` | Post-verification confirmation |
| `/forgot-password` | `ForgotPasswordPage` | Request password reset |
| `/reset-password` | `ResetPasswordPage` | Enter new password via reset token |
| `/dashboard` | `Dashboard` | Source library + session list (Protected) |
| `/chat/:id` | `Chat` | Main AI workspace — split-pane layout (Protected) |
| `/settings` | — | Redirect alias → `/dashboard` |
| `*` | `NotFoundPage` | 404 catch-all |

The Chat page (`/chat/:id`) has four resizable panels:
  * **Sources Panel:** Sidebar showing active sources with live indexing status badges.
  * **Chat Panel:** Chat thread, prompt input, and streaming SSE token display.
  * **Studio Panel:** Cypher query interface and vis-network graph visualization.
  * **Canvas Graph View:** vis-network canvas that updates in real time during `subgraph_mode`.

### Zustand State Stores
* `authStore` — Handles user session, token refresh, and login/logout lifecycle.
* `chatStore` — Handles active session data, message lists, streaming text state, and current token usage metrics.
* `sourceStore` — Handles uploaded source libraries and active SSE indexing progress streams.
* `themeStore` — Theme store managing `light` / `dark` (and `system`) preferences. Persists to `localStorage`.

### Key Custom Components
1. **`GraphLMLogo.jsx`** (`Components/Common/`): A theme-aware SVG branding component. Reads `resolvedTheme` from `themeStore` to automatically switch between `graphlm-logo-dark.svg`, `graphlm-logo-light.svg`, or `graphlm-icon.svg` (icon-only variant). Accepts an `onClick` prop for dashboard routing.
2. **`AuthShell.jsx`** (`Components/Auth/`): A shared layout wrapper used on auth-adjacent pages (Forgot Password, Reset Password). Features an animated HTML5 Canvas particle graph background.
3. **`ProtectedRoute.jsx`** (`Components/Auth/`): HOC that guards `/dashboard` and `/chat/:id` routes. Redirects unauthenticated users to `/auth`.
4. **`ThemeToggleButton.jsx`** (`Components/Theme/`): A simple button that calls `toggleTheme()` from `themeStore`. Displays 🌞/🌙 based on current theme.
5. **`themeStore` theme engine:** Applies/removes the `.dark` CSS class on `document.documentElement` to activate Tailwind v4 CSS variable overrides defined in `index.css`.

---

## 13. Configuration Reference (.env)

These settings are managed via Pydantic Settings in `app/core/config.py`.

| Variable | Default Value | Purpose |
|---|---|---|
| `POSTGRES_USER` | `myuser` | Relational database username. |
| `POSTGRES_PASSWORD` | `mypassword` | Relational database password. |
| `POSTGRES_DB` | `graphlm` | Database name. |
| `DATABASE_URL` | `postgresql+psycopg2://myuser:mypassword@localhost:5433/graphlm` | SQL connection string (required). |
| `ASYNC_DATABASE_URL` | *Derived or Hardcoded* | `postgresql://myuser:mypassword@localhost:5433/graphlm` (No driver prefix). |
| `ACCESS_TOKEN_SECRET` | — | Cryptographic signature token for JWT. |
| `ACCESS_TOKEN_EXPIRE_HOURS`| `15` | Expiry duration. |
| `REFRESH_TOKEN_SECRET` | — | Cryptographic signature token for refresh JWT. |
| `REFRESH_TOKEN_EXPIRE_DAYS`| `7` | Expiry duration. |
| `PORT` | `4000` | Local port for Backend service. |
| `HOST` | `127.0.0.1` | Local bind host. |
| `ENVIRONMENT` | `development` | Environment mode: `development` \| `production`. |
| `DEBUG` | `False` | Enables detailed logger output if True. |
| `CLIENT_URL` | `http://localhost:5173` | Handoff origin for OAuth. |
| `BASE_URL` | `http://localhost:4000/` | Base URL used in emails. |
| `MAILTRAP_SMTP_HOST` | `sandbox.smtp.mailtrap.io` | Mailtrap testing host. |
| `MAILTRAP_SMTP_PORT` | `2525` | Mailtrap testing port. |
| `MAILTRAP_SMTP_USER` | — | Mailtrap account username. |
| `MAILTRAP_SMTP_PASS` | — | Mailtrap account password. |
| `CLOUDINARY_CLOUD_NAME`| — | Cloudinary cloud identifier. |
| `CLOUDINARY_API_KEY` | — | Cloudinary credentials. |
| `CLOUDINARY_API_SECRET`| — | Cloudinary credentials. |
| `NEO4J_URI` | `bolt://localhost:7687` | Bolt connection string for Neo4j. |
| `NEO4J_USERNAME` | `neo4j` | Database username. |
| `NEO4J_PASSWORD` | — | Neo4j password (must match compose setup). |
| `QDRANT_URL` | `http://localhost:6333` | Vector database endpoint. |
| `QDRANT_API_KEY` | (blank for local) | Vector database API Key. |
| `OPENAI_API_KEY` | — | OpenAI API credentials. |
| `OPENAI_LLM_MODEL` | `gpt-4o-mini` | Defaults to `gpt-4o-mini` for chat tasks. |
| `OPENAI_EMBEDDING_MODEL`| `text-embedding-3-small`| Embedding model. |
| `MEM0_API_KEY` | — | Mem0 cloud service API credentials. |
| `GITHUB_CLIENT_ID` | — | GitHub OAuth app identifier. |
| `GITHUB_CLIENT_SECRET` | — | GitHub OAuth app credential secret. |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | — | Personal Access Token to ingest private repositories. |
| `CHUNK_SIZE` | `1000` | Document parser split size. |
| `CHUNK_OVERLAP` | `200` | Chunk overlap boundary. |

---

## 14. Running the Project (Step-by-Step)

### Prerequisites
* Docker Desktop installed.
* Python 3.11+ installed.
* Node.js 18+ installed.

### Step 1: Initialize Environment
Navigate to the root directory and copy the environment template:
```bash
cd "graphlm-fastapi"
cp .env.sample .env
```
Fill in the required fields: `OPENAI_API_KEY`, `MEM0_API_KEY`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `NEO4J_PASSWORD`.

> [!NOTE]
> The docker-compose.yml reads `NEO4J_PASSWORD` from your `.env` via `${NEO4J_PASSWORD:-reform-william-center-vibrate-press-5829}`. If `NEO4J_PASSWORD` is not set in `.env`, it falls back to the default password shown above. Make sure the value matches what you set in `.env`.

### Step 2: Start Infrastructure
Launch the background databases and caching layers using Docker:
```bash
docker compose up -d
docker compose ps # Confirm all services are up
```

### Step 3: Set Up Python Environment
Create a virtual environment and install the dependencies:
```bash
python -m venv .venv
source .venv/bin/activate # Windows: .venv\Scripts\activate

# Install core and RAG/AI dependencies separately
pip install -r requirements.txt
pip install -r requirements-ai.txt
```

### Step 4: Run Migrations
Run the Alembic migrations to set up the PostgreSQL schema and triggers:
```bash
alembic upgrade head
```

### Step 5: Start the Backend Service
Start the FastAPI server:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 4000 --reload
```
* **Swagger UI:** `http://localhost:4000/docs`
* **ReDoc:** `http://localhost:4000/redoc`

### Step 6: Start the Frontend Application
Open a new terminal, navigate to the frontend directory, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
* **Application Interface:** `http://localhost:5173`

### local Service Dashboard URLs
* **Frontend Application:** `http://localhost:5173`
* **FastAPI Swagger docs:** `http://localhost:4000/docs`
* **Qdrant Vector Dashboard:** `http://localhost:6333/dashboard`
* **Neo4j Graph Database Browser:** `http://localhost:7474`

---

## 15. Key Design Decisions & Rationale

### Connection Pool Preservation during LLM Processing
SQLAlchemy database transactions are strictly closed before triggering downstream LLM operations. Because LLM generation can take 5-30 seconds, holding open database connections during this time would quickly exhaust the connection pool. Closing transactions early keeps the pool available for other incoming requests.

### Non-blocking Two-phase Indexing
Vector indexing is critical and blocks chatting, whereas graph indexing runs asynchronously in the background. Generating a knowledge graph requires expensive LLM parsing that is prone to network and schema exceptions. If Neo4j indexing fails, the user can still chat using vector search alone.

### Immutable Source Configuration during Active Chats
Once a chat session has active messages, additional sources cannot be attached or detached. This keeps the RAG context stable throughout the conversation.

### Single-Writer mem0 Integration
To prevent duplicate facts and high cloud costs, the Agent is the exclusive writer to the Mem0 API (via the `save_memory` tool). No other parts of the application write to Mem0.

### Decoupled Subgraph Scoping
Selecting focus sources in the UI limits the visual graph rendered on the canvas, but does not affect the search scope of the agent's RAG tools. This lets users inspect specific documents visually while the agent retains access to all session documents for reasoning.

### LISTEN/NOTIFY Event Ingestion
Rather than polling a REST endpoint to check document indexing status, GraphLM uses Postgres triggers combined with an `asyncpg` listener. This setup pushes real-time status updates directly to the frontend over a single SSE connection.

### Asynchronous Context Compaction
When a chat session exceeds its token budget, context compaction is scheduled as a background task. This keeps compaction processing out of the request path, ensuring low and predictable chat response latencies for the user.
