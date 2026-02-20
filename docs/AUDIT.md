# Production Readiness Audit — Rostra

**Date:** 2026-02-19
**Scope:** Full codebase — security, code quality, UX, technical debt
**Findings:** 35 issues (3 high, 14 medium, 18 low)
**Last Progress Update:** 2026-02-20

---

## Table of Contents

0. [Progress Status](#0-progress-status)
1. [Critical / High Priority](#1-critical--high-priority)
2. [Medium Priority — Security](#2-medium-priority--security)
3. [Medium Priority — Code Quality & UX](#3-medium-priority--code-quality--ux)
4. [Low Priority](#4-low-priority)
5. [What's Done Well](#5-whats-done-well)

---

## 0. Progress Status

Status legend:
- `DONE` — implemented and verified in current branch state
- `PARTIAL` — some work landed, but item is not fully complete
- `PLANNED` — scoped and documented, implementation pending
- `OPEN` — not started

Snapshot totals:
- `DONE`: 20
- `PARTIAL`: 1
- `PLANNED`: 1
- `OPEN`: 13

| Item | Status | Notes |
|---|---|---|
| 1.1 | DONE | Reconnect re-subscribe bug fixed in `ChatLayout` |
| 1.2 | DONE | `python-jose` replaced with `PyJWT` |
| 1.3 | PLANNED | Cookie migration plan: [`COOKIE_AUTH_IMPLEMENTATION_PLAN.md`](../COOKIE_AUTH_IMPLEMENTATION_PLAN.md) |
| 2.1 | DONE | Rate limits added on missing high-risk endpoints |
| 2.2 | DONE | CORS methods/headers moved to explicit allowlists |
| 2.3 | DONE | Security headers added (backend + Vercel config) |
| 2.4 | DONE | WebSocket `JSON.parse` wrapped in `try/catch` |
| 2.5 | DONE | Broadcast loop hardened against per-connection send failures |
| 2.6 | DONE | Per-connection room subscription cap added |
| 2.7 | DONE | WS handler responses use safe send path |
| 3.1 | DONE | Top-level React Error Boundary added |
| 3.2 | DONE | Stale closure timeout race fixed with refs |
| 3.3 | DONE | Message send UX fixed (preserve input + user-visible errors) |
| 3.4 | OPEN | Accessibility gaps still pending |
| 3.5 | OPEN | FK `ondelete` migration/model updates pending |
| 3.6 | OPEN | N+1 unread count path in cache population is still present |
| 3.7 | PARTIAL | `no-console` enforced; `jsx-a11y` and TS strict migration still pending |
| 4.1 | DONE | Login timing side-channel mitigated with dummy verify |
| 4.2 | OPEN | Login/Register still use `<a href>` for internal nav |
| 4.3 | DONE | `UserLogin` max length constraints added |
| 4.4 | OPEN | SQLAlchemy 1.x style still present in `room.py`/`message.py` |
| 4.5 | OPEN | PK `Integer` → `BigInteger` migration not done |
| 4.6 | OPEN | Duplicate `OnlineUser` interfaces still present |
| 4.7 | DONE | Redis URL moved into centralized settings |
| 4.8 | DONE | Redis connection logging now redacts credentials |
| 4.9 | DONE | Broad `Exception` catch removed from password verify path |
| 4.10 | OPEN | Remaining f-string logger calls still present |
| 4.11 | OPEN | Missing CRUD return type hints still present |
| 4.12 | DONE | Swagger/OpenAPI disabled when `DEBUG` is false |
| 4.13 | DONE | DB health endpoint now requires auth |
| 4.14 | DONE | Frontend console logging gated/replaced via logger utility |
| 4.15 | OPEN | Typing cooldown timeout cleanup on unmount still pending |
| 4.16 | OPEN | Dead `isMobile` prop still present |
| 4.17 | OPEN | `break-all` still used for message text |
| 4.18 | OPEN | Unread refresh on WS reconnect still pending |

---

## 1. Critical / High Priority

### 1.1 WebSocket subscriptions silently lost on reconnect (BUG)

**File:** `frontend/src/components/ChatLayout.tsx:320-335`
**Category:** Functionality bug

`subscribedSentRef` is a `Set<number>` that tracks which rooms the client has already sent a `subscribe` action for. Its purpose is to avoid duplicate subscribe messages when the effect re-runs. However, **it is never cleared on WebSocket reconnect**.

When the WebSocket disconnects (network blip, server restart) and reconnects, the server has lost all subscription state — no rooms are subscribed on the server side. But the client's `subscribedSentRef` still contains all previously-subscribed room IDs, so the subscription effect skips re-subscribing:

```typescript
// ChatLayout.tsx:320-335
useEffect(() => {
    if (!connected || subscribedRoomIds.length === 0) return;

    subscribedRoomIds.forEach((id) => {
      if (!subscribedSentRef.current.has(id)) {  // <-- Always true after reconnect
        subscribe(id);
        subscribedSentRef.current.add(id);
      }
    });
    // ...
}, [connected, subscribedRoomIds, subscribe]);
```

**Impact:** After any network interruption, no rooms receive real-time messages. The user must manually navigate away from the chat page and back, or refresh the browser. This is a silent failure — no error is shown.

**Fix:** Clear `subscribedSentRef.current` when `connected` transitions from `false` to `true`. Use a `prevConnectedRef` to detect the transition.

---

### 1.2 `python-jose` has known CVEs

**File:** `backend/app/core/security.py:5`
**Category:** Security — dependency vulnerability

```python
from jose import JWTError, jwt
```

`python-jose` has not been updated since 2022 and has two known CVEs:
- **CVE-2024-33663:** Algorithm confusion attack — an attacker with access to the public key can forge tokens by exploiting ECDSA/HMAC confusion.
- **CVE-2024-33664:** Denial of service via crafted JWE token.

While this app uses HS256 (symmetric, so CVE-2024-33663 requires the secret key to exploit), the library is a known liability. Security scanners will flag it, and it will not receive patches.

**Fix:** Replace with `PyJWT` (`import jwt` from `PyJWT`). The API is nearly identical for HS256:

```python
# Before (python-jose)
jwt.encode(payload, secret, algorithm="HS256")
jwt.decode(token, secret, algorithms=["HS256"])

# After (PyJWT)
jwt.encode(payload, secret, algorithm="HS256")
jwt.decode(token, secret, algorithms=["HS256"])
```

The main difference is the exception class (`jose.JWTError` → `jwt.PyJWTError` or specific subclasses like `jwt.ExpiredSignatureError`).

---

### 1.3 JWT stored in localStorage

**File:** `frontend/src/context/AuthContext.tsx:22-23`
**Category:** Security — token storage
**Status:** `PLANNED` — implementation plan tracked in [`COOKIE_AUTH_IMPLEMENTATION_PLAN.md`](../COOKIE_AUTH_IMPLEMENTATION_PLAN.md)

```typescript
const storedToken = localStorage.getItem("token");
```

The JWT is stored in `localStorage`, which is accessible to any JavaScript running on the page. If any XSS vector exists — a vulnerable dependency, a future `dangerouslySetInnerHTML` usage, a browser extension — an attacker can exfiltrate the token with `localStorage.getItem("token")` and gain full API access.

The WORKFLOW.md explicitly states: *"Auth tokens stored in httpOnly cookies (not localStorage — XSS vulnerability)."*

**Current mitigations:** The codebase has zero XSS vectors today (no `dangerouslySetInnerHTML`, all user content rendered as text via JSX). This is documented as an accepted tradeoff in PATTERNS.md.

**Impact:** Low today (no XSS vectors exist), but high future risk. Any new dependency or feature that introduces XSS becomes an instant full-compromise.

**Fix (if migrating):** Backend sets JWT as an httpOnly, Secure, SameSite=Strict cookie. Frontend sends `credentials: "include"` on all requests. CORS must have `allow_credentials=True` (already set). WebSocket auth would need a different approach (cookie-based instead of query param).

**Note:** This is a significant architectural change. May be acceptable as an acknowledged risk with strong CSP headers as a compensating control.

---

## 2. Medium Priority — Security

### 2.1 Missing rate limits on key endpoints

**Files:** `backend/app/api/rooms.py`, `backend/app/api/messages.py`
**Category:** Security — abuse prevention

The following endpoints have no rate limiting:

| Endpoint | Risk |
|---|---|
| `POST /api/rooms` | Room creation spam — fill the database with garbage rooms |
| `POST /api/messages` | Message spam via REST (WS has 30/min limit, but REST has none) |
| `GET /api/rooms/{id}/messages/search` | Full-text search is expensive; repeated queries can overload PostgreSQL |
| `PATCH /api/rooms/{id}/read` | Redis cache manipulation (low risk but unbounded) |

Compare with endpoints that ARE rate-limited: `register` (5/min), `login` (10/min), `join/leave` (10/min), `discover` (30/min).

**Fix:** Add `@limiter.limit()` decorators. Suggested limits:
- `POST /api/rooms`: 10/minute
- `POST /api/messages`: 30/minute (match WS rate)
- `GET /api/rooms/{id}/messages/search`: 10/minute
- `PATCH /api/rooms/{id}/read`: 30/minute

---

### 2.2 CORS `allow_methods` and `allow_headers` are `["*"]`

**File:** `backend/app/main.py:56-62`
**Category:** Security — CORS misconfiguration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,  # Properly restricted
    allow_credentials=True,
    allow_methods=["*"],   # <-- Overly permissive
    allow_headers=["*"],   # <-- Overly permissive
)
```

While `allow_origins` is correctly restricted via config, the wildcard methods and headers allow any HTTP method (including PUT, TRACE, etc.) and any request header from allowed origins. This expands the attack surface unnecessarily.

**Fix:**
```python
allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type"],
```

---

### 2.3 Missing security headers

**Backend file:** `backend/app/main.py:66-71`
**Frontend file:** `frontend/vercel.json`
**Category:** Security — HTTP headers

The backend security headers middleware only sets two headers:

```python
response.headers["X-Content-Type-Options"] = "nosniff"
response.headers["X-Frame-Options"] = "DENY"
```

**Missing headers:**

| Header | Purpose |
|---|---|
| `Strict-Transport-Security` | Forces HTTPS; prevents SSL-stripping attacks |
| `Content-Security-Policy` | Prevents XSS by controlling allowed script/style sources |
| `Referrer-Policy` | Controls what URL info is sent in the Referer header |
| `Permissions-Policy` | Restricts browser API access (camera, microphone, geolocation) |
| `X-XSS-Protection: 0` | Explicitly disables the legacy XSS auditor (it can introduce vulnerabilities) |

The frontend (`vercel.json`) has **no** security headers at all — static files are served from Vercel without any of these protections. This is the more critical gap because the frontend is what browsers interact with.

**Fix (backend):** Add the missing headers to the existing middleware.
**Fix (frontend):** Add a `headers` section to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

---

### 2.4 No `try/catch` around `JSON.parse` on WebSocket messages

**File:** `frontend/src/services/websocket.ts:110-113`
**Category:** Security / Reliability

```typescript
this.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);  // <-- No try/catch
    console.log("WebSocket received:", data);
    this.onMessageCallback?.(data);
};
```

A malformed message from the server (or a man-in-the-middle on non-TLS connections) will throw an uncaught exception that crashes the `onmessage` handler. The WebSocket connection stays open but stops processing messages — a silent failure.

**Fix:** Wrap in try/catch:
```typescript
this.ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        this.onMessageCallback?.(data);
    } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
    }
};
```

---

### 2.5 WebSocket broadcast failure breaks remaining subscribers

**File:** `backend/app/websocket/connection_manager.py:138-141`
**Category:** Reliability

```python
# Send to all subscribers
for connection in self.room_subscriptions[room_id]:
    if connection != exclude:
        await connection.send_json(message)  # <-- Exception here stops the loop
```

If `send_json` raises for one connection (e.g., the client disconnected between iteration start and send), the remaining subscribers in the loop will NOT receive the message. The exception propagates to the caller.

**Fix:** Wrap each send in a per-connection try/except and collect dead connections for cleanup:
```python
dead_connections = []
for connection in self.room_subscriptions[room_id]:
    if connection != exclude:
        try:
            await connection.send_json(message)
        except Exception:
            dead_connections.append(connection)
for conn in dead_connections:
    self.room_subscriptions[room_id].discard(conn)
```

---

### 2.6 No limit on simultaneous room subscriptions (WebSocket)

**File:** `backend/app/websocket/connection_manager.py:95-106`
**Category:** Security — resource exhaustion

```python
def subscribe_to_room(self, websocket: WebSocket, room_id: int):
    if room_id not in self.room_subscriptions:
        self.room_subscriptions[room_id] = set()
    self.room_subscriptions[room_id].add(websocket)  # <-- No limit check
```

A malicious client can subscribe to every room in the system. Each subscription means the client receives every message broadcast for that room. With hundreds of rooms, this generates significant broadcast traffic and memory pressure.

**Fix:** Check subscription count before adding. Cap at 20-50 rooms per connection:
```python
MAX_SUBSCRIPTIONS_PER_USER = 50

def subscribe_to_room(self, websocket, room_id):
    current_count = sum(1 for subs in self.room_subscriptions.values() if websocket in subs)
    if current_count >= MAX_SUBSCRIPTIONS_PER_USER:
        return False  # Reject subscription
    # ... existing logic
```

---

### 2.7 No `try/except` on WebSocket `send_json()` responses in handlers

**File:** `backend/app/websocket/handlers.py` (multiple locations)
**Category:** Reliability

After processing a subscribe/unsubscribe/send_message action, the handler sends a response directly to the client:

```python
await websocket.send_json({
    "type": "subscribed",
    "room_id": room_id,
    "online_users": [{"id": u.id, "username": u.username} for u in users],
})
```

If the client disconnected between receiving the action and the response being sent, this raises a `RuntimeError` or `ConnectionClosedError`. The main loop catches `WebSocketDisconnect`, but `send_json` may raise different exception types that bypass that handler.

**Fix:** Wrap all `send_json` calls in try/except, or create a `safe_send` helper that catches and logs connection errors.

---

## 3. Medium Priority — Code Quality & UX

### 3.1 No React Error Boundary

**File:** `frontend/src/App.tsx`
**Category:** UX — error handling

There is no `ErrorBoundary` component anywhere in the component tree. If any component throws during render (null reference on a malformed WebSocket message, unexpected API response shape, etc.), the entire app white-screens with no recovery option.

**Fix:** Add a top-level `ErrorBoundary` class component with a "Something went wrong" fallback UI and a "Reload" button.

---

### 3.2 Stale closure on `timeoutError` in finally blocks

**Files:** `frontend/src/components/MessageList.tsx:128-172`, `frontend/src/components/RoomList.tsx:75-110`
**Category:** Bug — race condition

```typescript
// MessageList.tsx
async function fetchMessages() {
    setTimeoutError(false);

    timeoutId = window.setTimeout(() => {
        setTimeoutError(true);          // (A) This sets state
        setError("Loading messages...");
        setLoading(false);
    }, 5000);

    try {
        const { messages } = await getRoomMessages(...);
        // ...
    } finally {
        if (!timeoutError) {    // (B) This reads the CLOSURE value, not current state
            setLoading(false);
        }
    }
}
```

At point (B), `timeoutError` is the value captured when `fetchMessages` was created — always `false`. Even if the timeout at point (A) fired and set it to `true` via `setTimeoutError(true)`, the closure still reads the original `false`. This means `setLoading(false)` executes unconditionally in the finally block, potentially conflicting with the timeout handler's own `setLoading(false)`.

Both files also suppress `react-hooks/exhaustive-deps` via eslint-disable, which masks this issue.

**Fix:** Use a ref (`useRef(false)`) for the timeout flag so the `finally` block reads the current value:
```typescript
const timeoutFiredRef = useRef(false);
// In timeout: timeoutFiredRef.current = true;
// In finally: if (!timeoutFiredRef.current) setLoading(false);
```

---

### 3.3 Send message failure silently discards user input

**File:** `frontend/src/components/MessageInput.tsx:55-63`
**Category:** UX — error handling

```typescript
try {
    wsSendMessage(roomId, content);
    setContent("");           // <-- Text cleared immediately
    // ...
    onMessageSent?.();
} catch (err) {
    console.error("Failed to send message", err);  // <-- Only logged, not shown
}
```

Two problems:
1. The message text is cleared on line 57 BEFORE the `try` block completes. If `wsSendMessage` throws, the user's text is already gone.
2. The error is only logged to console — the user sees no feedback that their message failed to send.

Additionally, `wsSendMessage` calls `wsRef.current?.send()` in `WebSocketService`, which simply logs when the socket is not connected (does not throw). So when the WS is disconnected, the message is silently dropped with no error and no indication to the user.

**Fix:** Only clear text after confirmed success. Show an inline error message below the input when sending fails. When the WS is disconnected, either queue the message or show a "not connected" indicator.

---

### 3.4 Accessibility gaps

**Category:** UX — accessibility (a11y)
**Files:** Multiple components

**Missing `aria-label` on icon-only buttons:**
All of these buttons have `title` (tooltip) but no `aria-label`. Screen readers do not consistently announce `title` attributes.

- Back button — `MessageArea.tsx` (the `←` arrow button)
- Room menu button — `MessageArea.tsx` (the `⋯` three-dot button)
- Search toggle — `MessageArea.tsx` (the search icon button)
- Users toggle — `MessageArea.tsx` (the users icon button)
- Password visibility toggle — `Login.tsx` and `Register.tsx`
- Close search — `SearchBar.tsx`

**Missing focus traps on modals:**
- `RoomDiscoveryModal` correctly traps focus (lines 60-96) — good.
- The delete room confirmation modal in `MessageArea.tsx` has NO focus trap.
- The create room modal in `RoomList.tsx` has NO focus trap.
- The logout confirmation modal has NO focus trap.

Keyboard users can Tab behind these modals into the obscured content.

**Missing Escape key handler:**
- The room options dropdown (three-dot menu in `MessageArea.tsx:198-240`) cannot be closed with the Escape key. Compare with `SearchBar` and `RoomDiscoveryModal` which both handle Escape correctly.

---

### 3.5 Missing `ondelete` on foreign keys

**Files:** `backend/app/models/room.py:15`, `backend/app/models/message.py:15-16`
**Category:** Database integrity

```python
# room.py
created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
#                                                    ^^ no ondelete

# message.py
room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
#                                                 ^^ no ondelete on either
```

Compare with `user_room.py` which correctly specifies `ondelete="CASCADE"` on both FKs.

The ORM-level `cascade="all, delete-orphan"` on Room's relationships handles deletes when using SQLAlchemy, but:
- Direct SQL deletes (admin queries, migration scripts, database tools) will fail with `IntegrityError` or leave orphaned records.
- If a user account is ever deleted, their messages and rooms become orphaned with dangling FK references.

**Fix:** Create a new Alembic migration to add `ON DELETE CASCADE` (for `messages.room_id`, `messages.user_id`) and `ON DELETE CASCADE` or `ON DELETE SET NULL` (for `rooms.created_by`, depending on whether orphaned rooms should survive user deletion). Update the model definitions to match.

---

### 3.6 N+1 query in `_populate_from_db`

**File:** `backend/app/services/cache_service.py:89-97`
**Category:** Performance

```python
# Fetches all memberships first...
result = await db.execute(select(UserRoom).where(UserRoom.user_id == user_id))
memberships = result.scalars().all()

# ...then queries unread count PER ROOM in a loop
unread_counts: dict[int, int] = {}
for membership in memberships:
    rid = cast(int, membership.room_id)
    count = await user_room_crud.get_unread_count(db, user_id, rid)  # <-- 1 query per room
    unread_counts[rid] = count
```

For a user in 20 rooms, this generates 21 database queries (1 for memberships + 20 for unread counts). The codebase already has `get_all_rooms_with_unread()` in `crud/room.py` that does this in a single query using JOINs and aggregation, but it is not used here.

**Fix:** Refactor `_populate_from_db` to use the single-query approach from `get_all_rooms_with_unread()`.

---

### 3.7 ESLint missing `no-console` and accessibility rules

**File:** `frontend/eslint.config.js`
**Category:** Tooling

The ESLint config includes `js.configs.recommended`, `tseslint.configs.recommended`, `reactHooks`, and `reactRefresh` — but is missing:

1. **No `no-console` rule:** Explains why 17 `console.log`/`console.error` statements survive linting. These leak chat content and connection details to browser dev tools in production.
2. **No `eslint-plugin-jsx-a11y`:** Would automatically catch the missing `aria-label` issues noted in 3.4.
3. **`tseslint.configs.recommended` vs `tseslint.configs.strict`:** The `recommended` preset is more lenient. `strict` catches additional issues.

**Fix:** Add `no-console: "warn"` to rules. Install and configure `eslint-plugin-jsx-a11y`.

---

## 4. Low Priority

### 4.1 Username enumeration via timing side-channel

**File:** `backend/app/api/auth.py:56-68`
**Category:** Security — information leakage

```python
db_user = await user_crud.get_user_by_username(db, user.username)
if not db_user:
    raise HTTPException(...)     # <-- Returns immediately (~1ms)

if not verify_password(user.password, db_user.hashed_password):
    raise HTTPException(...)     # <-- Returns after Argon2 hash (~100ms+)
```

An attacker can determine whether a username exists by measuring response time. The "user not found" path returns in ~1ms; the "wrong password" path takes ~100ms+ due to Argon2 hashing.

**Fix:** When the user is not found, perform a dummy `verify_password("dummy", DUMMY_HASH)` call so both paths take the same time.

---

### 4.2 `<a href>` instead of `<Link>` for internal navigation

**Files:** `frontend/src/pages/Login.tsx:270`, `frontend/src/pages/Register.tsx:302`
**Category:** UX — performance

```tsx
<a href="/register" ...>Don't have an account? Register</a>
```

These cause a full page reload instead of client-side navigation, which:
- Flashes white / reloads the entire React app
- Loses any in-memory state
- Is noticeably slower than SPA navigation

**Fix:** Replace with `<Link to="/register">` from `react-router-dom`.

---

### 4.3 `UserLogin` schema has no `max_length` constraints

**File:** `backend/app/schemas/user.py:14-18`
**Category:** Security — input validation

```python
class UserLogin(BaseModel):
    username: str       # <-- No max_length
    password: str       # <-- No max_length
```

Compare with `UserCreate` which has `max_length=50` on both fields. Without constraints, an attacker can send a multi-megabyte password. Argon2 will attempt to hash the entire input, consuming CPU and memory.

**Fix:** Add `Field(max_length=50)` to both fields (matching `UserCreate`).

---

### 4.4 Mixed SQLAlchemy 1.x and 2.0 model styles

**Files:** All models in `backend/app/models/`
**Category:** Consistency / technical debt

The codebase mixes two SQLAlchemy styles:

**2.0 style** (`user.py`, `user_room.py`):
```python
id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
username: Mapped[str] = mapped_column(String, unique=True, index=True)
```

**1.x style** (`room.py`, `message.py`):
```python
id = Column(Integer, primary_key=True, index=True)
name = Column(String, index=True, unique=True, nullable=False)
```

Additionally, `database.py:41` uses the legacy `declarative_base()` function:
```python
Base = declarative_base(metadata=meta)
```

SQLAlchemy 2.0 recommends:
```python
class Base(DeclarativeBase):
    metadata = meta
```

WORKFLOW.md mandates: *"SQLAlchemy 2.0 mapped_column style ONLY. Never use SQLAlchemy 1.x patterns."*

**Fix:** Migrate `room.py` and `message.py` to `mapped_column` style. Update `database.py` to use `DeclarativeBase`. This will also eliminate many `# type: ignore` comments in the routers.

---

### 4.5 `Integer` primary keys instead of `BigInteger`

**Files:** All models (`user.py:12`, `room.py:13`, `message.py:14`, `user_room.py:13`)
**Category:** Scalability

All tables use 32-bit `Integer` primary keys (max ~2.1 billion). WORKFLOW.md states: *"BIGINT for all primary keys."*

For `messages`, this could become a real issue in a high-traffic chat app. For `users` and `rooms`, it is unlikely to matter, but consistency with the stated convention is important.

**Fix:** Create a migration to alter PK columns to `BigInteger`. Note: this also requires updating all FK columns that reference them.

---

### 4.6 Duplicate `OnlineUser` interface

**Files:** `frontend/src/types/index.ts:9-12`, `frontend/src/components/ChatLayout.tsx:15-18`, `frontend/src/components/UsersPanel.tsx:8-11`
**Category:** Code quality — DRY violation

The same interface is defined in three places:
```typescript
interface OnlineUser {
    id: number;
    username: string;
}
```

**Fix:** Import from `types/index.ts` everywhere. Delete the duplicate definitions.

---

### 4.7 Redis URL via `os.getenv` bypasses Settings

**File:** `backend/app/core/redis.py:16`
**Category:** Consistency

```python
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
```

Every other config value goes through the centralized `Settings` class in `config.py` (via pydantic-settings). Redis bypasses this, which means:
- It won't appear in Settings validation errors
- It can't be overridden in test fixtures via `Settings` mocking

**Fix:** Add `REDIS_URL: str = "redis://localhost:6379/0"` to the `Settings` class. Import from there.

---

### 4.8 Redis URL potentially logged with credentials

**File:** `backend/app/core/redis.py:40`
**Category:** Security — credential leakage

```python
logger.info("Redis connected: %s", REDIS_URL)
```

If the Redis URL contains auth credentials (e.g., `redis://:password@host:6379`), the password will appear in application logs.

**Fix:** Parse the URL and redact the password before logging, or log only the host/port.

---

### 4.9 Broad `Exception` catch in `verify_password`

**File:** `backend/app/core/security.py:13-19`
**Category:** Code quality — error handling

```python
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, Exception):  # <-- Bare Exception catches everything
        return False
```

The `Exception` catch silently swallows any error (corrupt hash, encoding errors, library bugs) and returns `False`. While this prevents crashes on login, it also hides bugs that would otherwise surface immediately.

**Fix:** Catch only `VerifyMismatchError` and `VerificationError` (the Argon2 base exception). Let other exceptions propagate.

---

### 4.10 F-string logging (eager evaluation)

**Files:** `backend/app/websocket/handlers.py` (lines 58, 67, 106, 110, 124, 146, 154, 163, etc.), `backend/app/api/rooms.py` (lines 254, 304)
**Category:** Performance — logging

```python
logger.info(f"User {user_id} subscribed to room {room_id}")   # <-- Eager: always evaluated
logger.info("User %s subscribed to room %s", user_id, room_id)  # <-- Lazy: only if INFO enabled
```

F-strings are evaluated regardless of log level. If the log level is set to WARNING in production, all the string formatting for INFO/DEBUG messages still runs. The codebase is inconsistent — some messages use `%s` style correctly, others use f-strings.

**Fix:** Replace f-strings with `%s` formatting in all `logger.*()` calls.

---

### 4.11 Missing return type annotations on CRUD functions

**Files:** `backend/app/crud/user.py`, `backend/app/crud/room.py`, `backend/app/crud/user_room.py`
**Category:** Code quality — type safety

Most CRUD functions lack return type annotations:

```python
# crud/user.py
async def get_user_by_username(db: AsyncSession, username: str):      # <-- No return type
async def get_user_by_email(db: AsyncSession, email: str):            # <-- No return type
async def create_user(db: AsyncSession, user: UserCreate):            # <-- No return type
```

WORKFLOW.md states: *"Type hints on everything. Every function signature has full type annotations."*

**Fix:** Add `-> User | None` for get functions, `-> User` for create, etc.

---

### 4.12 Swagger UI always enabled in production

**File:** `backend/app/main.py:28-33`
**Category:** Security — information disclosure

```python
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",  # <-- Always available
    swagger_ui_parameters={"persistAuthorization": True},
)
```

The OpenAPI spec and Swagger UI are available at `/api/openapi.json` and `/docs` in production. This gives attackers a complete map of every endpoint, parameter, and response schema.

**Fix:** Conditionally disable in production:
```python
openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
```

---

### 4.13 DB health endpoint unauthenticated

**File:** `backend/app/main.py:86-99`
**Category:** Security — information disclosure

```python
@app.get(f"{settings.API_V1_STR}/health/db")
async def db_health():
    pool = async_engine.pool
    return {
        "pool_size": pool.size(),
        "checked_out": checked_out,
        "overflow": overflow,
        "status": "healthy" if pool_size > 0 else "degraded",
    }
```

This endpoint requires no authentication and returns database connection pool metrics. An attacker can use this to:
- Monitor load patterns and time attacks for maximum impact
- Detect when the pool is exhausted (potential DoS confirmation)

**Fix:** Either add auth (`Depends(get_current_user)`) or remove the detailed metrics, returning only `{"status": "healthy"}`.

---

### 4.14 Console logging in production (frontend)

**Files:** `frontend/src/services/websocket.ts` (10 calls), `frontend/src/components/RoomDiscoveryModal.tsx` (3 calls), and 4 other components
**Category:** Security / Code quality

```typescript
console.log("WebSocket received:", data);  // <-- Logs ALL message content to console
```

17 total `console.log`/`console.error` calls across the frontend. The WebSocket logging is particularly concerning — it logs every single message (including content) to the browser console, visible to anyone who opens dev tools.

**Fix:** Remove all console statements, or gate behind a `VITE_DEBUG` flag. Add `no-console: "warn"` to ESLint to prevent new ones.

---

### 4.15 Typing cooldown `setTimeout` not cleaned on unmount

**File:** `frontend/src/components/MessageInput.tsx:40-43`
**Category:** Code quality — memory leak

```typescript
setTimeout(() => {
    typingCooldownRef.current = false;
}, 2000);
```

This timeout is never cleared on component unmount. If the component unmounts while the timeout is pending, it executes against a stale ref. Since it only touches a ref (not state), it won't cause a React warning, but it is still a minor leak.

Compare with ChatLayout's typing timeouts which are properly tracked in a `Set<timeout>` and cleaned up on unmount.

**Fix:** Track the timeout ID and clear it in a cleanup effect.

---

### 4.16 `isMobile` prop is dead code

**File:** `frontend/src/components/ChatLayout.tsx:403`
**Category:** Code quality — dead code

```typescript
<MessageArea
    isMobile={true}   // <-- Always true, never read by MessageArea
    ...
/>
```

The `isMobile` prop is declared in the `MessageAreaProps` interface but is not used inside the `MessageArea` component.

**Fix:** Remove the prop from the interface, the prop pass in ChatLayout, and the destructuring (if any) in MessageArea.

---

### 4.17 `break-all` instead of `break-word` for message text

**File:** `frontend/src/components/MessageList.tsx:583`
**Category:** UX — text rendering

```tsx
<p className="... break-all">
```

`break-all` breaks words at any character, which produces ugly line breaks in the middle of normal words. `break-words` (Tailwind class for `overflow-wrap: break-word`) is more appropriate — it prefers breaking at word boundaries and only breaks mid-word as a last resort (e.g., for very long URLs).

**Fix:** Replace `break-all` with `break-words`.

---

### 4.18 Unread counts not refreshed after WebSocket reconnect

**Category:** UX — data staleness
**Related to:** Issue 1.1 (subscriptions lost on reconnect)

When the WebSocket disconnects, messages may arrive that the client does not receive. The unread counts shown in the sidebar become stale. They are only refreshed when the room list is re-fetched (via `refreshTrigger` in `RoomList`), but no reconnection event triggers a re-fetch.

**Fix:** After WebSocket reconnection, trigger a room list refresh to sync unread counts from the server.

---

## 5. What's Done Well

These are areas where the codebase demonstrates strong engineering:

- **No raw SQL or string interpolation** — All queries use SQLAlchemy's parameterized query builder. Zero SQL injection risk.
- **Argon2id for password hashing** — The best available algorithm (PHC winner, memory-hard, GPU-resistant). Proper library usage with good defaults.
- **WebSocket auth before accept** — Token is validated and user is looked up BEFORE `websocket.accept()`. Invalid tokens get `close(code=1008)`.
- **Per-message DB sessions in WS handlers** — Each action creates a short-lived `async with AsyncSessionLocal()` block, preventing long-lived session leaks from WebSocket connections.
- **Cursor-based pagination** — Proper keyset pagination with `(created_at, id)` cursor encoded as base64 JSON. Composite index `(room_id, created_at DESC, id DESC)` ensures efficient seeks. `limit + 1` pattern detects `has_more` without a separate COUNT query.
- **Redis graceful fallback** — All cache operations catch `RedisError` and fall back to PostgreSQL. The app works without Redis.
- **Zero `any` types in TypeScript** — The entire frontend codebase uses proper types. Strong `tsconfig` with `strict: true`, `noUnusedLocals`, `noUnusedParameters`.
- **No `dangerouslySetInnerHTML`** — All user content (messages, usernames, room names) is rendered as text via JSX, which React auto-escapes. No XSS vectors.
- **Clean separation of concerns** — Thin routers, CRUD layer, services layer, WebSocket handlers. Each layer has a clear responsibility.
- **`plainto_tsquery` for search** — Safely handles raw user input without SQL injection risk (unlike `to_tsquery` which accepts query operators).
- **Proper 401 handling** — API client calls `onUnauthorized()` which clears token and redirects. No retry on 401. Chain is clean.
- **Modern, well-maintained stack** — React 19, react-router-dom v7, Vite 7, TypeScript 5.9, Tailwind v4. No deprecated or abandoned dependencies.
- **`pool_pre_ping=True`** — Detects dead database connections before handing them out. Prevents "connection already closed" errors.
- **WS message rate limiting** — In-memory fixed-window rate limit (30/min per user) checked before opening a DB session. Prevents message spam via WebSocket.
- **Secret key has no default** — `SECRET_KEY: str` in Settings has no default value, so the app fails to start without it configured. This is correct fail-closed behavior.
