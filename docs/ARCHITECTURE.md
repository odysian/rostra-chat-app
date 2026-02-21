# Architecture

## Overview

Rostra is a real-time chat application. Users register and log in with username/password, discover and join named rooms, and send text messages. Messages are delivered in real time over WebSockets; the app also shows who is currently in each room (online users). Room access is controlled by explicit membership — users must join a room before they can view messages, send messages, or subscribe via WebSocket. Unread counts per room are tracked via a `user_room` table (last read timestamp) and cached in Redis with PostgreSQL fallback. Message history supports cursor-based pagination for infinite scroll. Rooms can be created and deleted (delete restricted to the room creator); members can leave rooms (except the creator). The stack is a React (Vite) frontend, FastAPI backend, PostgreSQL database, and Redis cache; all tables live in the `rostra` schema.

## Tech Stack

| Layer        | Technology              | Why (as implemented) |
|-------------|-------------------------|------------------------|
| Frontend    | React 19 + TypeScript   | SPA with hooks; Vite for dev/build |
| Routing     | react-router-dom v7     | Client-side routes: /, /login, /register, /chat |
| Styling     | Tailwind CSS v4         | Utility classes; Cinzel for branding |
| Backend     | FastAPI (Python)        | REST API + WebSocket endpoint; Pydantic validation |
| Database    | PostgreSQL              | Via SQLAlchemy 2; schema `rostra` |
| Migrations  | Alembic                 | All schema changes in `backend/alembic/versions/` |
| Auth        | JWT (python-jose) + bcrypt (passlib) | Stateless auth; token in `Authorization: Bearer` and in WebSocket query param |
| Real-time   | Native WebSocket (FastAPI) | Single `/ws/connect` endpoint; token in query string |
| Cache       | Redis (async via redis.asyncio) | Unread count caching with 24h TTL; graceful fallback to PostgreSQL if Redis unavailable |
| Rate limiting | slowapi | Protects auth endpoints (5–10/min) and room management (10–30/min) |
| DB driver   | asyncpg (via SQLAlchemy async) | Async PostgreSQL driver; all CRUD operations use AsyncSession |
| Pagination  | Cursor-based (base64-encoded) | Opaque `(created_at, id)` cursor tokens for message history; no offset pagination |

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser (React SPA – Vite dev or static build)                          │
│  - Auth: token in localStorage; 401 → redirect to /login               │
│  - REST: fetch to VITE_API_URL (e.g. http://localhost:8000)             │
│  - WS:   WebSocket to same origin /ws/connect?token=<jwt>                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                         │
        ▼                       ▼                         ▼
   REST /api/*            GET / (health)            WebSocket /ws/connect
   (auth, rooms,              │                              │
    messages)                 │                              │
        │                     │                              │
        └─────────────────────┴──────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FastAPI (uvicorn)                                                        │
│  - CORS from settings.BACKEND_CORS_ORIGINS                               │
│  - Security headers: X-Content-Type-Options, X-Frame-Options             │
│  - Rate limiting: slowapi on auth + room management endpoints            │
│  - Routers: auth, rooms, messages; WebSocket route in main.py            │
│  - DB: AsyncSession via get_db() dependency; async engine                │
└──────────────────┬──────────────────────────────┬───────────────────────┘
                   │                              │
                   ▼                              ▼
┌──────────────────────────────────┐  ┌───────────────────────────────────┐
│  PostgreSQL (schema: rostra)     │  │  Redis                            │
│  - users, rooms, messages,       │  │  - Unread count cache             │
│    user_room                     │  │  - Key: rostra:unread:user_{id}   │
│  - Composite index for           │  │  - 24h TTL; fallback to PG        │
│    cursor pagination             │  │                                   │
└──────────────────────────────────┘  └───────────────────────────────────┘
```

## Database Schema

All tables are in schema **rostra**.

### Tables

| Table       | Columns | Description |
|------------|---------|-------------|
| **users**  | `id` (PK), `username`, `email`, `hashed_password`, `created_at` | User accounts; username and email unique. |
| **rooms**  | `id` (PK), `name`, `created_by` (FK → users.id), `created_at` | Chat rooms; name unique. |
| **messages** | `id` (PK), `room_id` (FK → rooms.id), `user_id` (FK → users.id), `content`, `created_at`, `search_vector` (generated tsvector) | One message per row. `search_vector` is a stored generated column: `to_tsvector('english', content)`. |
| **user_room** | `id` (PK), `user_id` (FK → users.id ON DELETE CASCADE), `room_id` (FK → rooms.id ON DELETE CASCADE), `last_read_at`, `joined_at` | Per-user read state per room; unique on (user_id, room_id). |

### Relationships

- **users** → **messages**: one-to-many (user.messages).
- **users** → **rooms** (as creator): one-to-many (user.rooms, room.created_by).
- **users** ↔ **rooms** (membership/read state): many-to-many via **user_room** (user.user_rooms, room.user_rooms).
- **rooms** → **messages**: one-to-many with cascade delete (room.messages).
- **rooms** → **user_room**: one-to-many with cascade delete.

### Indexes (from migrations and models)

- **users**: `ix_users_id`, `ix_users_username` (unique), `ix_users_email` (unique).
- **rooms**: `ix_rooms_id`, `ix_rooms_name` (unique).
- **messages**: `ix_messages_id`, `ix_messages_room_created_id` composite index on `(room_id, created_at DESC, id DESC)` — covers cursor-based pagination queries (WHERE + ORDER BY + seek). `ix_messages_search_vector` GIN index on `search_vector` — covers full-text search queries (`@@` operator).
- **user_room**: `ix_user_room_user` (user_id), `ix_user_room_room` (room_id); unique constraint `uq_user_room` on (user_id, room_id).

## API Contracts

Base URL: `{API_URL}/api` (e.g. `http://localhost:8000/api`). Auth where required: `Authorization: Bearer <access_token>`.

### Health

| Method | Path   | Auth | Description |
|--------|--------|------|-------------|
| GET    | /      | No   | Health check; returns `{"message": "Chat API is running"}`. |
| GET    | /api/health/db | Yes  | DB pool metrics for authenticated operational checks; returns `{ pool_size, checked_out, overflow, status }`. |

### Auth (`/api/auth`)

| Method | Path           | Auth | Description |
|--------|----------------|------|-------------|
| POST   | /auth/register | No   | Body: `UserCreate` (username, email, password). Returns `{ access_token, token_type: "bearer" }` (same shape as login — enables auto-login). 400 if username or email taken. **Rate limited: 5/min.** |
| POST   | /auth/login    | No   | Body: `UserLogin` (username, password). Returns `{ access_token, token_type: "bearer" }`. 401 if invalid. **Rate limited: 10/min.** |
| GET    | /auth/me       | Yes  | Returns current user `UserResponse`. 401 if invalid/missing token. |

### Rooms (`/api/rooms`)

| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| GET    | /rooms            | Yes  | List rooms the current user is a member of. Query: `include_unread=true` to include `unread_count` per room (Redis cache with PG fallback). |
| GET    | /rooms/discover   | Yes  | List all public rooms for discovery (includes rooms user has not joined). **Rate limited: 30/min.** |
| POST   | /rooms            | Yes  | Body: `RoomCreate` (name, 3–50 chars). Creates room; creator is automatically added as first member. 400 if name exists. |
| GET    | /rooms/{room_id}  | Yes  | Get one room. 403 if not a member. 404 if not found. |
| POST   | /rooms/{room_id}/join | Yes | Join a room (add membership). 409 if already a member. 404 if room not found. **Rate limited: 10/min.** |
| POST   | /rooms/{room_id}/leave | Yes | Leave a room. 403 if user is room creator (creators must delete, not leave). 404 if not found. **Rate limited: 10/min.** |
| PATCH  | /rooms/{room_id}/read | Yes | Mark room as read for current user (updates last_read_at, resets Redis cache). 403 if not a member. 404 if room not found. Returns `{ status, room_id, last_read_at }`. |
| DELETE | /rooms/{room_id}  | Yes  | Delete room. 403 unless current user is room creator. 404 if not found. |

### Messages (mounted at `/api`)

| Method | Path                     | Auth | Description |
|--------|--------------------------|------|-------------|
| GET    | /rooms/{room_id}/messages/search | Yes | Full-text search within a room. Query: `q` (1–200 chars, required), `limit` (1–50, default 20), `cursor` (opaque string). Uses Postgres `plainto_tsquery` with `'english'` config (stemming, stop word removal). Returns `PaginatedMessages { messages, next_cursor }` ordered by recency. 403 if not a room member. 404 if room not found. 422 if `q` missing/invalid. 400 if cursor malformed. |
| GET    | /rooms/{room_id}/messages | Yes  | Cursor-paginated message history. Query: `cursor` (opaque string), `limit` (1–100, default 50). Returns `PaginatedMessages { messages, next_cursor }`. `next_cursor` is null when no older messages exist. 403 if not a room member. 400 if cursor is malformed. 404 if room not found. |
| POST   | /messages                | Yes  | Body: `MessageCreate` (room_id, content 1–1000 chars). Creates message as current user. 403 if not a room member. 404 if room not found. |

### WebSocket

| Endpoint      | Auth | Description |
|---------------|------|-------------|
| WS /ws/connect | Query param `token` (JWT) | Connect with `?token=<jwt>`. Rejected with close code 1008 if token invalid or user not found. After accept: client sends JSON with `action`; server sends JSON events. |

**Client → Server (actions):**

- `{ "action": "subscribe", "room_id": int }` — Subscribe to room; server checks room exists and user is a member. Returns online user list on success.
- `{ "action": "unsubscribe", "room_id": int }` — Unsubscribe from room.
- `{ "action": "send_message", "room_id": int, "content": str }` — Send message (1–1000 chars); checks membership, persists to DB, marks room read for sender, updates Redis unread cache for other members, then broadcasts.
- `{ "action": "user_typing", "room_id": int }` — Notify server that user is typing. Requires active subscription to the room. Broadcasts `typing_indicator` to other subscribers (sender excluded). No DB session needed — uses in-memory subscription check.

**Server → Client (events):**

- `{ "type": "subscribed", "room_id": int, "online_users": [{ "id", "username" }] }`
- `{ "type": "unsubscribed", "room_id": int }`
- `{ "type": "new_message", "message": { id, room_id, user_id, username, content, created_at } }`
- `{ "type": "user_joined", "room_id": int, "user": { id, username } }`
- `{ "type": "user_left", "room_id": int, "user": { id, username } }`
- `{ "type": "typing_indicator", "room_id": int, "user": { id, username } }`
- `{ "type": "error", "message": str, "details"?: ... }`

## Key Architectural Decisions

| Decision | Choice | Visible in code / rationale |
|----------|--------|-----------------------------|
| Real-time delivery | WebSockets instead of polling | Single long-lived connection; subscribe/unsubscribe per room; broadcast on new message. |
| Auth for WebSocket | JWT in query param before accept | `websocket_endpoint` decodes token and closes with 1008 if invalid; no HTTP headers on WS handshake. |
| Auth for REST | JWT in `Authorization: Bearer` | `get_current_user` dependency uses `HTTPBearer()`; all room and message endpoints require auth. |
| Room access | Explicit membership via `user_room` table | Users must join a room before they can view, send, or subscribe. Membership checked on subscribe, send_message, GET messages, mark read. Room creators cannot leave (must delete). |
| Unread counts | Redis cache with PG fallback | `UnreadCountCache` uses Redis hash `rostra:unread:user_{id}` with 24h TTL. Atomic `HINCRBY` on new messages, `HDEL` on mark-read. Falls back to `get_all_rooms_with_unread` SQL query if Redis is unavailable. |
| Redis configuration/logging | Redis URL is centralized in settings and credential-safe in logs | `REDIS_URL` is read from `Settings`; startup logs redact URL passwords while preserving host/port/db context for debugging. |
| Message pagination | Cursor-based (keyset pagination) | `(created_at, id)` cursor encoded as base64 JSON. Composite index `(room_id, created_at DESC, id DESC)` for efficient seeks. `limit + 1` pattern detects `has_more` without a separate COUNT query. |
| Message history | REST for history, WS for live | Messages loaded via paginated GET endpoint; new messages pushed via WebSocket; no WS history replay. |
| Async everywhere | AsyncSession, async CRUD, asyncpg | All endpoints use `async def`, all DB operations use `await`. WebSocket handlers create short-lived `AsyncSessionLocal()` sessions per message (like mini HTTP requests). |
| Rate limiting | slowapi on abuse-prone endpoints | Register (5/min), login (10/min), join/leave (10/min), discover (30/min). Disabled in tests via high limits in conftest. |
| WS rate limiting | In-memory fixed-window in ConnectionManager | `check_message_rate(user_id, max_per_minute=30)` — per-user 60s window tracked in `_message_counts` dict. Checked before DB session is opened for `send_message`. Cleaned up on disconnect. |
| API docs exposure | OpenAPI/Swagger/ReDoc enabled only in debug mode | `main.py` gates `openapi_url`, `docs_url`, and `redoc_url` behind `settings.DEBUG`; production defaults to disabled to reduce endpoint discovery exposure. |
| Frontend auth persistence | Token in localStorage | AuthContext stores token in localStorage; 401 from API triggers redirect to /login via `setUnauthorizedHandler`. |
| DB schema | All tables in `rostra` | `MetaData(schema="rostra")` in database.py; migrations create tables in that schema. |
| Message search | Postgres FTS with GIN-indexed tsvector | Stored generated column `to_tsvector('english', content)` on messages. `plainto_tsquery` for safe user input parsing. GIN index for fast lookups. Results ordered by recency (not relevance) — matches chat UX where users want recent matches. Scales to millions of rows; would graduate to Elasticsearch only for fuzzy/typo tolerance. |

## Directory Structure

### Backend (`backend/app/`)

```
app/
├── main.py                  # App factory, middleware, CORS, WebSocket route
├── core/                    # Framework-level concerns
│   ├── config.py            # Settings via pydantic-settings
│   ├── database.py          # Async engine, AsyncSessionLocal, Base
│   ├── logging.py           # Structured logger setup
│   ├── rate_limit.py        # slowapi limiter configuration
│   ├── redis.py             # Async Redis client singleton
│   └── security.py          # JWT encode/decode, password hashing
├── models/                  # SQLAlchemy models (one file per domain)
│   ├── user.py
│   ├── room.py
│   ├── message.py
│   └── user_room.py
├── schemas/                 # Pydantic request/response models
│   ├── user.py
│   ├── room.py
│   └── message.py
├── api/                     # Route handlers (one file per domain)
│   ├── auth.py
│   ├── rooms.py
│   ├── messages.py
│   └── health.py
├── crud/                    # Database query functions
│   ├── user.py
│   ├── room.py
│   ├── message.py
│   └── user_room.py
├── services/                # Business logic beyond CRUD
│   └── cache_service.py     # UnreadCountCache (Redis wrapper)
├── websocket/               # WebSocket subsystem
│   ├── connection_manager.py  # In-memory connection + room tracking
│   ├── handlers.py          # Action handlers (subscribe, send_message, etc.)
│   └── schemas.py           # Pydantic models for WS actions and events
└── utils/                   # Shared helpers
    └── cursor.py            # Pagination cursor encode/decode
```

### Frontend (`frontend/src/`)

```
src/
├── assets/                  # Static assets (images, fonts)
├── components/              # React components
│   ├── ChatLayout.tsx       # Top-level chat orchestrator (state, WS handler, subscriptions)
│   ├── Sidebar.tsx          # Room list + create room + logout
│   ├── RoomList.tsx         # Room listing with unread badges
│   ├── MessageArea.tsx      # Header + MessageList + MessageInput (no search state)
│   ├── MessageList.tsx      # Scrollable messages with infinite scroll
│   ├── MessageInput.tsx     # Text input + send button
│   ├── SearchPanel.tsx      # Right sidebar for search (owns search state, contains SearchBar + SearchResults)
│   ├── SearchBar.tsx        # Debounced search input with ESC-to-close
│   ├── SearchResults.tsx    # Search results list with load-more pagination
│   ├── UsersPanel.tsx       # Online users sidebar
│   └── ...                  # Auth components, modals, loading states
├── context/                 # React context providers
│   ├── AuthContext.tsx       # Auth state, login/logout, token management
│   ├── WebSocketContext.tsx  # WS lifecycle, subscribe/unsubscribe/send
│   ├── webSocketContextState.ts  # Context type definitions
│   └── useWebSocketContext.ts    # Typed hook for consuming WS context
├── pages/                   # Route-level page components
│   ├── LandingPage.tsx
│   ├── Login.tsx
│   └── Register.tsx
├── services/                # External communication
│   ├── api.ts               # REST API client (apiCall, named functions)
│   └── websocket.ts         # WebSocketService class (connect, reconnect, send)
├── types/                   # Shared TypeScript types
│   └── index.ts             # User, Room, Message, WS event types
└── styles/                  # Global CSS
    └── index.css
```
