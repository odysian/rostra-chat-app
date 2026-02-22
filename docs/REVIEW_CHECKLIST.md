# Code Review Checklist

Use this after agent sessions or before committing. Not every item applies to every change. Items are tailored to this app (Rostra) and to AGENTS.md.

## Security (Check Every Time)

### General (from AGENTS.md)

- [ ] **Input validation:** All user input validated (Pydantic on backend; frontend room name length checked in RoomList; no Zod).
- [ ] **Authentication:** Protected HTTP routes use `get_current_user` dependency; WebSocket validates JWT from query param before accept.
- [ ] **Authorization:** Room delete checks `room.created_by == current_user.id`. Room membership enforced on: GET room details, GET/POST messages, WS subscribe, WS send_message, mark room read. Join/leave endpoints manage membership. Creators cannot leave their own room.
- [ ] **SQL injection:** No raw SQL; SQLAlchemy parameterizes. No string interpolation in queries.
- [ ] **XSS:** Message/content from API or WS is rendered as text in React (no `dangerouslySetInnerHTML`). Usernames and room names from server are also plain text. If rich content is added later, sanitize or escape.
- [ ] **Secrets:** No API keys, passwords, or DB URLs in code. Config from pydantic-settings / `VITE_API_URL`; `.env` not committed.
- [ ] **CORS:** Uses `settings.BACKEND_CORS_ORIGINS` (list), not `*` in production.
- [ ] **Rate limiting:** Implemented via slowapi on register (5/min), login (10/min), join/leave (10/min), discover (30/min). Verify new public or abuse-prone endpoints also have limits.

### App-specific

- [ ] **WebSocket auth:** New/changed WS routes still require token in query and reject with 1008 before accept.
- [ ] **Message sanitization:** Message `content` is length-limited (1–1000) and stored/echoed as-is. No HTML/script stripping; UI renders as text only. If rendering changes, add sanitization.
- [ ] **Room access:** Users must be a room member to subscribe (WS), send messages, or fetch messages. Membership is checked via `user_room` table. New endpoints that access room data should verify membership.
- [ ] **Context jump authorization/scope:** `/rooms/{room_id}/messages/{message_id}/context` and `/rooms/{room_id}/messages/newer` enforce room membership and reject message IDs that are outside the requested room.
- [ ] **File uploads:** None in the app. If added, validate type, size, and content per AGENTS.md.

## Performance (Check for Data-Heavy Features)

### General

- [ ] **N+1 queries:** No loops that run a query per item. Messages for a room use `joinedload(Message.user)`; rooms with unread use single `get_all_rooms_with_unread` query.
- [ ] **Missing indexes:** New WHERE/JOIN columns should be indexed. Messages have composite index `ix_messages_room_created_id` on `(room_id, created_at DESC, id DESC)` for cursor pagination.
- [ ] **Unnecessary data:** APIs return only what the frontend needs (e.g. RoomResponse with optional unread_count).
- [ ] **Frontend:** No unnecessary useEffect for data that could be server-fetched (this app is SPA; all data is client-fetched or WS).

### App-specific

- [ ] **Message list query:** GET messages uses cursor-based pagination (default limit 50, max 100). Composite index on `(room_id, created_at DESC, id DESC)` supports efficient keyset seeks.
- [ ] **Bidirectional context pagination:** `older_cursor` and `newer_cursor` respect strict keyset boundaries (`created_at`, `id` tiebreak) and preserve stable ordering (`context` oldest->newest, `newer` oldest->newest).
- [ ] **WebSocket connection count:** One WS per logged-in user; ConnectionManager holds all in memory. No per-user or global connection limit in code; consider limits for scale.
- [ ] **Unread count:** Redis cache (`UnreadCountCache`) with PostgreSQL fallback. Verify new message-related features update the cache correctly (increment for recipients, reset for sender).
- [ ] **Redis availability:** Cache operations catch `RedisError` and fall back gracefully. New cache usage should follow the same pattern.

## Code Quality

- [ ] **Error handling:** Errors not swallowed; either rethrow or return/display. Errors shown via inline state (e.g. `deleteError` in MessageArea, `leaveError` in ChatLayout).
- [ ] **Types:** No `any` in TypeScript; use `unknown` and narrow if needed. Backend uses type hints and Pydantic.
- [ ] **Edge cases:** Empty input, null, long strings (Pydantic max lengths; frontend room name 3–50).
- [ ] **Consistency:** Matches patterns in PATTERNS.md (error shape, auth, API client, component structure).
- [ ] **Frontend bloat guardrail:** For touched container components, target around 350 LOC and keep <= 450 LOC, or create a linked follow-up Task in the same PR with explicit split scope.
- [ ] **Responsibility boundaries:** Components do not accumulate mixed concerns (data orchestration + modal orchestration + heavy rendering) when extraction is feasible.
- [ ] **Contract stability:** Refactors preserve public props/callback semantics unless contract changes are explicitly scoped and tests are updated.
- [ ] **Dead code:** No unused imports, commented-out blocks, or unused variables. `useWebSocket` hook exists alongside WebSocketContext; ChatLayout uses context only.
- [ ] **Naming:** Clear names; follows naming conventions in PATTERNS.md.

## Database

- [ ] **Migrations:** Schema changes have an Alembic migration; no direct DB edits.
- [ ] **Reversible:** Migration has a working `downgrade()`.
- [ ] **Foreign keys:** ON DELETE specified (user_room: CASCADE; rooms.created_by and messages FKs: no explicit ON DELETE in models — check migration defaults).
- [ ] **Indexes:** New query columns indexed. user_room has (user_id, room_id) and separate indexes per migration.

## Testing

- [ ] **Happy path:** New behavior works with valid input.
- [ ] **Error path:** Invalid input, missing resource, auth failure return expected status and message.
- [ ] **Edge cases:** Empty list, boundary lengths, etc. Backend uses pytest with real test DB (savepoint rollback). Frontend uses Vitest + React Testing Library test files under `frontend/src/**/__tests__/`.
- [ ] **TESTPLAN.md:** New test cases added to `backend/TESTPLAN.md` before writing tests (per AGENTS.md rule).

## Verification Commands (this project)

Run from **project root** unless noted. These match the Verification section in AGENTS.md.

### Backend (`backend/`)

- [ ] **Lint:** `cd backend && ruff check .`
- [ ] **Types:** `cd backend && mypy . --ignore-missing-imports`
- [ ] **Tests:** `cd backend && pytest -v`
- [ ] **Security scan:** `cd backend && bandit -r app/ -ll`

### Frontend (`frontend/`)

- [ ] **Types:** `cd frontend && npx tsc --noEmit`
- [ ] **Lint:** `cd frontend && npm run lint`
- [ ] **Build:** `cd frontend && npm run build`

### Database

- [ ] **Migrations:** `cd backend && alembic check` (single head); then `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`.

### Documentation

- [ ] **ARCHITECTURE.md** updated if DB schema, API endpoints, or WS events changed.
- [ ] **PATTERNS.md** updated if new code patterns or conventions introduced.
- [ ] **REVIEW_CHECKLIST.md** updated if new check categories needed.

### Before commit

- [ ] **App runs:** Backend (uvicorn) and frontend (`npm run dev`) start without errors.
- [ ] **Commit message:** `type: short description` (e.g. `feat: ...`, `fix: ...`, `refactor: ...`).
