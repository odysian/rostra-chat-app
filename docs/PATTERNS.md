# Patterns

Reusable code patterns and conventions in this project. All of the following are taken from the current codebase.

## Error Handling

### Backend (FastAPI)

- Error responses use a single `detail` field: `{"detail": "Human-readable message"}`.
- Use `HTTPException(status_code=..., detail="...")` for expected errors (e.g. 400, 401, 403, 404). Optional `headers={"WWW-Authenticate": "Bearer"}` on 401.
- No global exception handler is defined; unhandled exceptions return FastAPI’s default JSON error. Stack traces are not explicitly exposed to clients.
- WebSocket errors are sent as JSON: `{ "type": "error", "message": "...", "details"?: ... }` via `send_error()`; invalid payloads are validated with Pydantic and replied to with this shape.

### Frontend (React)

- API calls are wrapped in try/catch; error message is taken from `err instanceof Error ? err.message : "fallback"` (API client puts `response.json().detail` or status text into `Error.message`).
- Errors are stored in local state (e.g. `error`, `setError`) and rendered in the UI (e.g. red box with message and optional Retry button).
- No error boundary is used; failed fetches are handled per component. Delete room failure uses inline error state in MessageArea's delete modal.
- 401: the API client calls `onUnauthorized()` (set by AuthContext), which clears token and redirects to `/login` via `window.location.href`.

## Authentication Pattern

### Backend

- JWT created with `create_access_token(data={"sub": str(user_id)})` (HS256, expiry from `ACCESS_TOKEN_EXPIRE_MINUTES`).
- Protected routes use dependency `get_current_user(db, credentials)`: `HTTPBearer()` for `Authorization: Bearer <token>` → `decode_access_token(token)` → `user_crud.get_user_by_id(db, int(user_id))`; 401 if token invalid or user missing.
- WebSocket: token is passed as query param `token`. Before `websocket.accept()`, `decode_access_token(token)` and user lookup; connection closed with code 1008 if invalid.

### Frontend

- Token is stored in **localStorage** under key `"token"` (not httpOnly cookie). AuthContext reads it on init and passes it to API/WebSocket.
- Login/Register call `auth.login(response.access_token)` which sets localStorage and state; then navigate to `/chat` or `/login`.
- Protected route: `ProtectedRoute` renders children only when `isAuthenticated` (token + user loaded); otherwise `<Navigate to="/login" />`.
- On app load, if token exists, `getCurrentUser(token)` is called; on failure token is cleared and not redirected (user sees auth flow when hitting protected route).
- 401 from any API call triggers `onUnauthorized()` → clear token/user and `window.location.href = "/login"`.

## API Client Pattern

- Single module: `frontend/src/services/api.ts`. Base URL from `VITE_API_URL` or `http://localhost:8000`; API prefix `/api`.
- All calls go through `apiCall<T>(endpoint, options)`: builds URL, sets `Content-Type: application/json`, merges headers. Auth is done by passing `Authorization: Bearer ${token}` in headers from callers.
- Retry: exponential backoff for network/5xx/timeout (max retries 4, no retry on 401). Timeout 10s per request.
- 401: if `onUnauthorized` is set (by AuthContext), it is called before throwing; no retry.
- Errors: message comes from `response.json().detail` when possible, else status text; thrown as `Error(message)`.
- Named functions per resource: `login`, `register`, `getCurrentUser`, `getRooms`, `discoverRooms`, `markRoomRead`, `createRoom`, `deleteRoom`, `joinRoom`, `leaveRoom`, `getRoomMessages` (with optional `cursor`), `sendMessage`. Each takes required params and `token` where auth is needed.

## Database Query Patterns

- **Async ORM only:** SQLAlchemy 2 async style; no raw SQL in app code. Session from `get_db()` dependency (`AsyncSession`). All CRUD functions are `async def` and use `await db.execute(select(...))`.
- **Relationships:** Eager load where needed to avoid N+1. Example: `get_messages_by_room` uses `.options(joinedload(Message.user))` so each message has `user` loaded for `username`.
- **Aggregations:** Complex stats in one query. Example: `get_all_rooms_with_unread` uses a single query with LEFT JOINs to `user_room` and `messages`, `group_by` Room, and `func.count(case(...))` for unread count per room.
- **Keyset pagination:** `get_messages_by_room` accepts optional `(before_created_at, before_id)` cursor. Uses `WHERE (created_at, id) < (cursor_ts, cursor_id)` with `ORDER BY created_at DESC, id DESC`. Fetches `limit + 1` rows to detect `has_more` without a COUNT query.
- **Writes:** Create model instance, `db.add()`, `await db.commit()`, `await db.refresh(instance)`; return instance.
- **Ids:** User ID for creates (room, message) comes from `current_user.id` in the router, not from request body.
- **WebSocket sessions:** WebSocket handlers do not receive a long-lived session. Each action creates a short-lived `async with AsyncSessionLocal() as db:` block — like a mini HTTP request. This prevents connection-pooling issues from long-lived WebSocket connections holding sessions open.

## Caching Pattern

- **Redis for unread counts:** `UnreadCountCache` in `services/cache_service.py` wraps Redis operations. Uses hash key `rostra:unread:user_{id}` with room_id as field and count as value. 24h TTL.
- **Operations:** `increment_unread(user_id, room_id)` uses atomic `HINCRBY`. `reset_unread(user_id, room_id)` uses `HDEL`. `get_unread_counts(user_id, room_ids)` uses `HMGET`.
- **Graceful fallback:** All cache methods catch `RedisError` and log a warning. Callers fall back to the PostgreSQL query (`get_all_rooms_with_unread`). The app works without Redis — just slower for unread counts.
- **Cache invalidation:** Sending a message increments unread for other members and resets for the sender. Marking a room as read resets the sender's count. No TTL-based staleness issues because state is updated on every relevant event.

## Component Structure Pattern

- **Functional components** only. No class components.
- **Props:** Interface defined above the component (e.g. `SidebarProps`, `MessageListProps`). Props destructured in the function signature.
- **Order inside component:** State (useState), refs, hooks (useAuth, useWebSocketContext, etc.), effects (useEffect), handlers (handleX), then return JSX.
- **Layout:** ChatLayout orchestrates shared state (selected room, online users, unread counts, subscriptions) and passes callbacks and data to Sidebar, MessageArea, UsersPanel. MessageArea composes MessageList and MessageInput. RoomList and Sidebar are separate; Sidebar contains RoomList.
- **Portals:** Modals (create room, delete room) use `createPortal(..., document.body)` to render outside the sidebar DOM hierarchy.
- **One WebSocket provider:** WebSocketProvider wraps ChatLayout; only chat page uses WebSocket. Auth state is above so token is available when mounting WebSocketProvider.

## WebSocket Pattern

- **Service class:** `WebSocketService` in `services/websocket.ts`. Constructor takes token; `connect()` builds URL `ws(s)://host/ws/connect?token=<token>`. Before connecting, token is validated via a quick GET to `/api/auth/me`.
- **Connection lifecycle:** `connect()` → onopen/onclose/onerror set status and call `onStatusChange`. On abnormal close (code !== 1000), `attemptReconnect()` with exponential backoff (max 5 retries, 2s base, 30s max delay, jitter). On success, retry count is reset. `disconnect()` sets `shouldReconnect = false`, closes socket, clears timeout.
- **Message handling:** `onMessage(callback)` stores a single callback; incoming JSON is passed to it. WebSocketContext sets this callback and also pushes the same message into `lastMessage` state and forwards to `messageHandlerRef.current` (so ChatLayout can register one handler and process every message without missing any between re-renders).
- **Sending:** `send(message)` does `ws.send(JSON.stringify(message))` if state is OPEN; otherwise logs and does nothing.
- **Context:** WebSocketProvider (inside ProtectedRoute) creates one WebSocketService per token, exposes `subscribe(roomId)`, `unsubscribe(roomId)`, `sendMessage(roomId, content)`, `sendTypingIndicator(roomId)`, `registerMessageHandler(fn)`, plus `connected`, `connectionStatus`, `lastMessage`. Subscriptions are sent as `{ action: "subscribe", room_id }`; ChatLayout subscribes to a bounded set of room IDs (LRU-style when over limit).
- **Typing indicators:** Client-side throttle (2s cooldown via ref in MessageInput) limits `user_typing` events. Server broadcasts `typing_indicator` to other room subscribers (sender excluded, no DB session needed — uses in-memory subscription check). ChatLayout tracks typing state per room (`typingUsersByRoom`) with a 3s auto-clear timeout per user; receiving a `new_message` from a user also clears their typing state. MessageArea always renders a fixed-height typing indicator container (`h-7 shrink-0`) to avoid layout shifts.
- **Token change:** `updateToken(newToken)` disconnects, sets token, re-enables reconnection, then `setTimeout(..., 100)` before `connect()` again.

## Naming Conventions (in use)

| Thing | Convention | Example |
|-------|------------|---------|
| Python modules | snake_case | `user_room.py`, `connection_manager.py` |
| Python classes | PascalCase | `ConnectionManager`, `User`, `RoomCreate` |
| Python functions | snake_case | `get_current_user`, `get_all_rooms_with_unread` |
| TypeScript/React files | PascalCase for components | `ChatLayout.tsx`, `MessageArea.tsx` |
| React components | PascalCase | `ChatLayout`, `RoomList`, `AuthLoadingOverlay` |
| Props interfaces | Component name + Props | `SidebarProps`, `MessageListProps` |
| Hooks | use + PascalCase | `useAuth`, `useWebSocketContext`, `useWebSocket` |
| API route files | Plural resource | `rooms.py`, `messages.py`, `auth.py` |
| Database tables | snake_case | `users`, `rooms`, `messages`, `user_room` |
| API paths | Plural, snake_case in body | `/rooms`, `/rooms/{id}/read`, body `room_id` |
| Environment variables | SCREAMING_SNAKE | `VITE_API_URL`, `DATABASE_URL`, `SECRET_KEY` |
| Context values | camelCase in TS | `connectionStatus`, `lastMessage`, `registerMessageHandler` |

## Alembic / Migration Conventions

- **Schema-aware autogenerate:** All tables live in the `rostra` schema (`MetaData(schema="rostra")`). The Alembic `env.py` uses a dedicated sync engine with `connect_args={"options": "-csearch_path=public"}` so that Alembic discovers `rostra` as a named (non-default) schema. Combined with `include_schemas=True` and an `include_name` filter that only accepts `schema == "rostra"`, this produces clean autogenerate output with no phantom diffs.
- **Index naming convention:** `MetaData` uses `naming_convention={"ix": "ix_%(table_name)s_%(column_0_name)s"}` instead of the default `ix_%(column_0_label)s`. The default includes the schema prefix in auto-generated names (e.g. `ix_rostra_users_id`), which mismatches existing migration indexes (`ix_users_id`). The custom convention keeps index names schema-free.
- **Explicit index names for non-standard patterns:** Indexes that don't follow the `ix_{table}_{column}` pattern (e.g. composite indexes, shortened names like `ix_user_room_user`) are defined with hardcoded names in `__table_args__` using `Index("ix_user_room_user", "user_id")`. This ensures autogenerate matches them to the database.
- **Migration-only indexes:** The composite pagination index `ix_messages_room_created_id` (with DESC ordering) is also defined in the model's `__table_args__` so autogenerate sees it. It was originally created via raw SQL in a migration.
- **Do not modify existing migration files.** If a migration has been applied, create a new migration for any changes. Editing applied migrations breaks `alembic upgrade` on existing databases.

## Other Conventions

- **Backend routers:** Thin; validation and auth via Depends; business logic in CRUD or websocket handlers. Services layer (`app/services/`) for cross-cutting concerns like caching. WebSocket subsystem has `handlers.py`, `connection_manager.py`, and `schemas.py`.
- **Schemas:** Pydantic in `schemas/` for request/response; WebSocket message shapes in `websocket/schemas.py` with Literal types for `action` and `type`.
- **Frontend types:** Centralized in `types/index.ts` (User, Room, Message, WS* types). No Zod in the repo; validation is backend Pydantic and frontend manual (e.g. room name length in RoomList).
- **Styling:** Tailwind only. No CSS modules. Custom font via `@theme { --font-cinzel: 'Cinzel', serif }` and class `font-cinzel`. Scrollbar styling in `index.css`.
- **Branding:** App name “Rostra”; accent color amber (e.g. `amber-500`, `text-amber-500`); dark theme (zinc-950, zinc-900, zinc-800).
