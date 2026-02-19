# Tasks

Based on the current codebase. Each task is scoped for one agent session (one endpoint, one component, or one fix). Mark with [x] when done.

## Obvious Incomplete / Fixes

- [x] **Fix RoomList Retry:** Added `retryCount` state; effect depends on it so "Retry" triggers a real refetch.
- [x] **Fix MessageList Retry:** Same `retryCount` pattern as RoomList.
- [x] **Delete room error UX:** Replaced `alert()` with inline `deleteError` state in the delete modal.
- [x] **Require auth for GET messages:** Both `GET /rooms/{room_id}/messages` and `GET /rooms/{room_id}/messages/search` require `get_current_user` and check room membership (403 if not a member).

## Potential Improvements

### Security

- [x] **Rate limiting:** slowapi on register (5/min), login (10/min), join/leave (10/min), discover (30/min).
- [x] **WebSocket rate limit:** Fixed-window rate limit (30 msgs/min per user) in `ConnectionManager.check_message_rate`, checked before DB work in `handle_send_message`.

### Performance / Data

- [x] **Index for message list:** Composite index `ix_messages_room_created_id` on `(room_id, created_at DESC, id DESC)` via migration + model `__table_args__`.
- [x] **Message pagination (backend):** Cursor-based pagination with `cursor` and `limit` query params. Returns `PaginatedMessages { messages, next_cursor }`.
- [x] **Message pagination (frontend):** Infinite scroll with `IntersectionObserver` sentinel at top of list. "Beginning of conversation" label when no more pages.

### Reliability / UX

- [x] **Auto-login after register:** Backend `/register` now returns a token (same shape as `/login`). Frontend calls `authLogin(token)` and navigates to `/chat` immediately.
- [ ] **WebSocket reconnection after token refresh:** `updateToken` exists on WebSocketService; hook it to auth refresh if/when token refresh is added.

### Code quality

- [x] **Remove unused `useWebSocket` hook:** Deleted `hooks/useWebSocket.ts` and empty `hooks/` directory. Was imported by zero files.
- [x] **Backend tooling:** `pyproject.toml` has `[tool.ruff]` and `[tool.mypy]` sections. Pytest and bandit work via defaults.
- [x] **Backend tests:** Comprehensive suite: `test_auth.py`, `test_rooms.py`, `test_messages.py`, `test_health.py`, `test_cursor.py`, `test_websocket_typing.py`.
- [ ] **Frontend tests:** No tests exist yet. Add React Testing Library and one test per major flow.

### Consistency / Docs

- [x] **GET messages auth:** ARCHITECTURE.md documents both endpoints as `Auth: Yes` with 403 for non-members. Key Decisions table confirms membership is checked on GET messages.

## Backlog (unprioritized)

- Private or invite-only rooms (membership table + checks in API and WS).
- Rich message content (e.g. markdown) and sanitization (see REVIEW_CHECKLIST).
- Full message history via WebSocket (replay after reconnect).
- Connection limits or backpressure for WebSocket (per user or global).

## Blockers

- None currently.

---

## Priority List (next up)

Ranked by impact and effort. Items at the top are highest priority.

### High Priority (bugs / dead code / quick wins) -- DONE --

1. **Delete `useWebSocket` hook** — Dead code. `hooks/useWebSocket.ts` duplicates `WebSocketContext` and is imported nowhere. Delete it. (5 min)
2. **WebSocket message rate limit** — Only server-side protection against spam. Add a per-connection counter in `handle_send_message` (e.g. 30 msgs/min) using an in-memory dict keyed by user_id with a sliding window or token bucket. No new dependencies needed. (30 min)
3. **Auto-login after register** — Small UX friction. Call `login()` after successful register, store the token, redirect to `/chat`. One change in `Register.tsx` + backend register endpoint could return a token. (30 min)

### Medium Priority (quality / resilience)

4. **Frontend tests** — No test coverage at all. Start with auth flow (login form validation, submit, error display) and room list (loading, empty state, error/retry). Use Vitest + React Testing Library (already Vite-based). (2-3 sessions)
5. **WebSocket reconnect replay** — After reconnect, the user misses messages sent during the disconnect. On reconnect, fetch messages since `last_message_id` via REST and merge into the list. Prevents "phantom gaps" in conversation. (1 session)
6. **User profile / display name** — Users only have `username`. Adding an editable display name (already a `username` field, but no edit flow) would improve identity. Low effort: one PATCH endpoint + a small settings modal. (1 session)

### Suggested New Features (good fit for Rostra)

7. **Message reactions (emoji)** — Lightweight engagement. New `message_reactions` table (`message_id`, `user_id`, `emoji`, unique constraint). One REST endpoint to toggle, one WS event to broadcast. Fits the existing WS pattern well. (2 sessions)
8. **Room member list / room info panel** — The online users panel only shows *currently connected* users. A room info panel could show all members, room creator, created date, and allow the creator to manage (kick members). Builds on existing `user_room` data. (1-2 sessions)
9. **Notification sounds / browser notifications** — `Notification.requestPermission()` + play a sound on `new_message` when the tab is not focused. Small but high-impact UX. (1 session)
10. **Message edit / delete** — Common chat feature. PATCH and DELETE on messages (author-only). WS events `message_edited` and `message_deleted` to update other clients. Needs a "edited" indicator in the UI. (2 sessions)

### On Pub/Sub Architecture

You mentioned considering pub/sub. Here's the practical assessment:

**On a single-node free-tier deployment, you already have pub/sub** — it's just in-process. Your `ConnectionManager` maintains a dict of room subscriptions and broadcasts to connected WebSocket clients. This *is* pub/sub, just without a message broker.

**When you'd actually need Redis Pub/Sub or similar:**
- Multiple backend processes/workers (e.g. Render upgrades to 2+ workers, or you scale horizontally)
- A message sent on worker A needs to reach clients connected to worker B
- At that point, you'd add `redis.pubsub()` channels per room, and each worker subscribes to rooms its clients care about

**For a single-node deployment, adding Redis Pub/Sub would add complexity with zero benefit** — messages would go `app → Redis → same app`, adding latency and a failure point for no gain. Your current in-memory `ConnectionManager` is the right architecture for your scale.

**If you want to future-proof without overengineering:** extract the broadcast logic in `ConnectionManager` behind a simple interface (`async def publish(room_id, event)`) so swapping to Redis Pub/Sub later is a one-file change. But don't build it until you actually run multiple workers.

---

**Rules:** One logical change per task (one endpoint, one component, one migration). Tasks should be clear enough to hand off to an agent with no extra context.
