# Code Review Checklist

Use this after agent sessions or before committing. Not every item applies to every change. Items are tailored to this app (Rostra) and to AGENTS.md.

## Security (Check Every Time)

### General (from AGENTS.md)

- [ ] **Input validation:** All user input validated (Pydantic on backend; frontend room name length checked in RoomList; no Zod).
- [ ] **Authentication:** Protected HTTP routes use `get_current_user` dependency; WebSocket validates JWT from query param before accept.
- [ ] **Authorization:** Room delete checks `room.created_by == current_user.id`; no other per-room “membership” check (any logged-in user can list rooms and send to any room).
- [ ] **SQL injection:** No raw SQL; SQLAlchemy parameterizes. No string interpolation in queries.
- [ ] **XSS:** Message/content from API or WS is rendered as text in React (no `dangerouslySetInnerHTML`). Usernames and room names from server are also plain text. If rich content is added later, sanitize or escape.
- [ ] **Secrets:** No API keys, passwords, or DB URLs in code. Config from pydantic-settings / `VITE_API_URL`; `.env` not committed.
- [ ] **CORS:** Uses `settings.BACKEND_CORS_ORIGINS` (list), not `*` in production.
- [ ] **Rate limiting:** Not implemented in codebase; consider for auth and public endpoints (e.g. GET messages).

### App-specific

- [ ] **WebSocket auth:** New/changed WS routes still require token in query and reject with 1008 before accept.
- [ ] **Message sanitization:** Message `content` is length-limited (1–1000) and stored/echoed as-is. No HTML/script stripping; UI renders as text only. If rendering changes, add sanitization.
- [ ] **Room access:** Current design: any authenticated user can subscribe and send to any room. If you add “private rooms” or invite-only, add checks in WS subscribe/send and in REST.
- [ ] **File uploads:** None in the app. If added, validate type, size, and content per AGENTS.md.

## Performance (Check for Data-Heavy Features)

### General

- [ ] **N+1 queries:** No loops that run a query per item. Messages for a room use `joinedload(Message.user)`; rooms with unread use single `get_all_rooms_with_unread` query.
- [ ] **Missing indexes:** New WHERE/JOIN columns should be indexed. Current: messages filtered by `room_id` and ordered by `created_at` (index on `(room_id, created_at)` not present — add if message tables grow large).
- [ ] **Unnecessary data:** APIs return only what the frontend needs (e.g. RoomResponse with optional unread_count).
- [ ] **Frontend:** No unnecessary useEffect for data that could be server-fetched (this app is SPA; all data is client-fetched or WS).

### App-specific

- [ ] **Message list query:** GET messages uses `limit` (default 50); order is `created_at.desc()`. Pagination or cursor not implemented; acceptable for small rooms.
- [ ] **WebSocket connection count:** One WS per logged-in user; ConnectionManager holds all in memory. No per-user or global connection limit in code; consider limits for scale.
- [ ] **Unread count:** Rooms list with `include_unread=true` uses one aggregated query; no N+1 per room.

## Code Quality

- [ ] **Error handling:** Errors not swallowed; either rethrow or return/display. Delete room failure in MessageArea uses `alert()` — consider inline error like other forms.
- [ ] **Types:** No `any` in TypeScript; use `unknown` and narrow if needed. Backend uses type hints and Pydantic.
- [ ] **Edge cases:** Empty input, null, long strings (Pydantic max lengths; frontend room name 3–50).
- [ ] **Consistency:** Matches patterns in PATTERNS.md (error shape, auth, API client, component structure).
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
- [ ] **Edge cases:** Empty list, boundary lengths, etc. No pytest/React Testing Library in repo yet; add when adding tests.

## Verification Commands (this project)

Run from **project root** unless noted.

### Backend (`backend/`)

- [ ] **Lint:** From `backend/`: `ruff check .` (if ruff is installed). No `pyproject.toml` in repo; config may be default or env.
- [ ] **Types:** From `backend/`: `mypy . --ignore-missing-imports` (if mypy installed).
- [ ] **Tests:** From `backend/`: `pytest -v` (if tests exist; none in codebase at review time).
- [ ] **Security scan:** From `backend/`: `bandit -r app/ -ll` (if bandit installed).

If these tools aren’t installed, add them and wire commands per AGENTS.md.

### Frontend (`frontend/`)

- [ ] **Types:** From `frontend/`: `npx tsc --noEmit` (or rely on `tsc -b` in build).
- [ ] **Lint:** From `frontend/`: `npm run lint` (runs `eslint .`).
- [ ] **Build:** From `frontend/`: `npm run build` (runs `tsc -b && vite build`).

### Database

- [ ] **Migrations:** From `backend/`: `alembic check` (single head); optionally `alembic upgrade head`, `alembic downgrade -1`, `alembic upgrade head`.

### Before commit

- [ ] **App runs:** Backend (uvicorn) and frontend (`npm run dev`) start without errors.
- [ ] **Commit message:** `type: short description` (e.g. `feat: ...`, `fix: ...`, `refactor: ...`).
