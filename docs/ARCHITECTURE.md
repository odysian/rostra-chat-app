# Architecture

## Overview

Rostra is a real-time chat application. Users register and log in with username/password, create or join named rooms, and send text messages. Messages are delivered in real time over WebSockets; the app also shows who is currently in each room (online users). Unread counts per room are tracked via a `user_room` table (last read timestamp), and rooms can be created and deleted (delete restricted to the room creator). The stack is a React (Vite) frontend, FastAPI backend, and PostgreSQL database; all tables live in the `rostra` schema.

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
│  - Routers: auth, rooms, messages; WebSocket route in main.py            │
│  - DB: get_db() dependency (SessionLocal); sync engine                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (schema: rostra)                                              │
│  - users, rooms, messages, user_room                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Database Schema

All tables are in schema **rostra**.

### Tables

| Table       | Columns | Description |
|------------|---------|-------------|
| **users**  | `id` (PK), `username`, `email`, `hashed_password`, `created_at` | User accounts; username and email unique. |
| **rooms**  | `id` (PK), `name`, `created_by` (FK → users.id), `created_at` | Chat rooms; name unique. |
| **messages** | `id` (PK), `room_id` (FK → rooms.id), `user_id` (FK → users.id), `content`, `created_at` | One message per row. |
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
- **messages**: `ix_messages_id`. (Note: no explicit index on `(room_id, created_at)` for message listing; queries use `room_id` and `order_by(created_at.desc())`.)
- **user_room**: `ix_user_room_user` (user_id), `ix_user_room_room` (room_id); unique constraint `uq_user_room` on (user_id, room_id).

## API Contracts

Base URL: `{API_URL}/api` (e.g. `http://localhost:8000/api`). Auth where required: `Authorization: Bearer <access_token>`.

### Health

| Method | Path   | Auth | Description |
|--------|--------|------|-------------|
| GET    | /      | No   | Health check; returns `{"message": "Chat API is running"}`. |

### Auth (`/api/auth`)

| Method | Path           | Auth | Description |
|--------|----------------|------|-------------|
| POST   | /auth/register | No   | Body: `UserCreate` (username, email, password). Returns `UserResponse`. 400 if username or email taken. |
| POST   | /auth/login    | No   | Body: `UserLogin` (username, password). Returns `{ access_token, token_type: "bearer" }`. 401 if invalid. |
| GET    | /auth/me       | Yes  | Returns current user `UserResponse`. 401 if invalid/missing token. |

### Rooms (`/api/rooms`)

| Method | Path              | Auth | Description |
|--------|-------------------|------|-------------|
| GET    | /rooms            | Yes  | List all rooms. Query: `include_unread=true` to include `unread_count` per room (single optimized query). |
| POST   | /rooms            | Yes  | Body: `RoomCreate` (name). Creates room with current user as creator. 400 if name exists. |
| GET    | /rooms/{room_id}  | Yes  | Get one room. 404 if not found. |
| PATCH  | /rooms/{room_id}/read | Yes | Mark room as read for current user (upserts user_room, sets last_read_at). 404 if room not found. Returns `{ status, room_id, last_read_at }`. |
| DELETE | /rooms/{room_id}  | Yes  | Delete room. 403 unless current user is room creator. 404 if not found. |

### Messages (mounted at `/api`)

| Method | Path                     | Auth | Description |
|--------|--------------------------|------|-------------|
| GET    | /rooms/{room_id}/messages | No   | List recent messages for room (default limit 50). Eager-loads user for username. 404 if room not found. |
| POST   | /messages                | Yes  | Body: `MessageCreate` (room_id, content). Creates message as current user. 404 if room not found. |

### WebSocket

| Endpoint      | Auth | Description |
|---------------|------|-------------|
| WS /ws/connect | Query param `token` (JWT) | Connect with `?token=<jwt>`. Rejected with close code 1008 if token invalid or user not found. After accept: client sends JSON with `action`; server sends JSON events. |

**Client → Server (actions):**

- `{ "action": "subscribe", "room_id": int }` — Subscribe to room; server checks room exists.
- `{ "action": "unsubscribe", "room_id": int }` — Unsubscribe.
- `{ "action": "send_message", "room_id": int, "content": str }` — Send message (1–1000 chars); persisted then broadcast; marks room read for sender.

**Server → Client (events):**

- `{ "type": "subscribed", "room_id": int, "online_users": [{ "id", "username" }] }`
- `{ "type": "unsubscribed", "room_id": int }`
- `{ "type": "new_message", "message": { id, room_id, user_id, username, content, created_at } }`
- `{ "type": "user_joined", "room_id": int, "user": { id, username } }`
- `{ "type": "user_left", "room_id": int, "user": { id, username } }`
- `{ "type": "error", "message": str, "details"?: ... }`

## Key Architectural Decisions

| Decision | Choice | Visible in code / rationale |
|----------|--------|-----------------------------|
| Real-time delivery | WebSockets instead of polling | Single long-lived connection; subscribe/unsubscribe per room; broadcast on new message. |
| Auth for WebSocket | JWT in query param before accept | `websocket_endpoint` decodes token and closes with 1008 if invalid; no HTTP headers on WS handshake. |
| Auth for REST | JWT in `Authorization: Bearer` | `get_current_user` dependency uses `HTTPBearer()`; used on rooms and messages POST; GET messages is intentionally public. |
| Room access | No room membership table for “allowed to join” | Any authenticated user can list rooms, subscribe via WS, and send messages to any room; only room creator can delete. |
| Unread counts | Single query with JOINs | `get_all_rooms_with_unread` uses LEFT JOINs and CASE to compute unread per room in one query (no N+1). |
| Message history | REST only | Messages are loaded via GET `/rooms/{room_id}/messages`; new messages via WebSocket; no WS history replay. |
| Frontend auth persistence | Token in localStorage | AuthContext stores token in localStorage; 401 from API triggers redirect to /login via `setUnauthorizedHandler`. |
| DB schema | All tables in `rostra` | `MetaData(schema="rostra")` in database.py; migrations create tables in that schema. |
