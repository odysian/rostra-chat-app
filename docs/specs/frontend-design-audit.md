# Frontend Design Audit and Phased Roadmap — Rostra

**Date:** 2026-02-21
**Status:** Phase 2 completed on 2026-02-21 (2.1-2.7 and 2.9-2.12 complete, 2.8 deferred). Phase 3 pending.
**Canonical file:** `docs/specs/frontend-design-audit.md`

---

## Summary
This document defines the prioritized, phased plan for frontend design improvements and related UX features.

- Phase 1: cosmetic readability pass only.
- Phase 2: frontend-only UX features.
- Phase 3: backend-coupled UX features (approved item-by-item).

Primary direction: improve readability and usability without losing the 1980s retro feel.

---

## Evaluation of Claude Pass

### Accepted as-is
- Strong Phase 1 component-by-component readability targets.
- Good expansion into backend-coupled opportunities (edit/delete/reactions/new-message divider).
- Useful effort/value framing and cross-phase testing focus.

### Accepted with revisions
- Unread badge contrast: keep dark text on bright badge backgrounds.
- Mobile discoverability wording: use "Back to rooms" affordance language (not hamburger).
- Search jump-to-message moved to backend-coupled scope so it can navigate to any message in room history.
- Command palette moved to frontend-only phase (no backend dependency).
- Phase 3 now includes explicit API/data/WS guardrails and open decisions before build.

### Deferred to parking lot
- Message permalinks/deep-link context loading (high complexity, lower immediate value).
- User profile status/bio (less aligned with immediate readability and flow goals).

---

## Scope Contract

### In Scope (Phase 1 only)
- CSS/Tailwind/style-token adjustments inside existing components.
- Typography, spacing, contrast, and readability improvements.
- Visual affordance polish with no behavior or data-flow changes.

### Out of Scope (Phase 1)
- New components.
- New interaction models or feature behavior.
- API contract/backend changes.
- New dependencies.

### Planned for Future Phases
- Phase 2: frontend-only UX features (no backend/API changes).
- Phase 3: backend-coupled features (schema/API/WS changes).

---

## Design Principles
- Readability first.
- Preserve retro identity (NEON/AMBER themes, CRT feel, purposeful pixel accents).
- Keep NEON and AMBER parity.
- Keep CRT mode legible and usable.
- Prioritize keyboard and mobile discoverability.
- Sequence work to avoid rework.

---

## Sequencing Rules (Prevent Rework)
1. Normalize shared visual tokens in `frontend/src/index.css` first.
2. Apply token-driven component visuals second.
3. Add behavior/features only after visual baseline is stable.
4. Keep backend-coupled features independent so each can ship alone.
5. Run full verification at each phase checkpoint.

---

## Phase 1 — Cosmetic Readability Pass

### Goal
Improve scanning, legibility, and control discoverability with no functional changes.

### Target Files
- `frontend/src/index.css`
- `frontend/src/components/MessageList.tsx`
- `frontend/src/components/RoomList.tsx`
- `frontend/src/components/UsersPanel.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/SearchBar.tsx`
- `frontend/src/components/SearchResults.tsx`
- `frontend/src/components/MessageArea.tsx`

### Planned Changes
- [x] Message density tuning in `MessageList`:
- Reduce content size/leading (`18px relaxed` -> `15px normal`).
- Tighten ungrouped/grouped spacing.
- Reduce avatar footprint and container padding.
- Improve date divider and "BEGINNING OF CONVERSATION" visibility.

- [x] Sidebar and users panel legibility:
- Increase tiny pixel label/button text size to readable minimum.
- Increase control hit area and spacing for theme/CRT buttons.
- Increase users panel width and username readability.
- Increase online dot/crown visibility.

- [x] Room list readability:
- Increase unread badge size/shape/weight.
- Keep dark text on bright unread background.
- Slightly relax room row vertical spacing.
- Improve ROOMS section label visibility.

- [x] Search panel consistency:
- Increase tiny metadata text where needed.
- Keep preview readable without matching full chat density.

- [x] Scrollbar visibility in `index.css`:
- Wider thumb, stronger color contrast.
- Add Firefox scrollbar styles (`scrollbar-width`, `scrollbar-color`) in addition to WebKit rules.

- [x] Focus affordance polish:
- Ensure icon-only controls show a visible `:focus-visible` outline.

- [x] Dropdown and modal micro-polish:
- Add hover background to room options menu items in `MessageArea` (currently no visible hover state).
- Bump create-room modal "ROOM NAME" label from `text-[7px]` to `text-[8px]` (consistent with other pixel label bumps).

- [x] Empty state polish in `MessageArea`:
- "Welcome to Rostra" / "Select a room" screen: slightly larger guidance text and subtle border container for more visual presence.

- [x] Accepted tradeoff:
- Keep fixed typing indicator height (`h-7`) to prevent layout shift.

### Acceptance Criteria
- No new components/state models/behavior.
- Visual improvements hold in NEON and AMBER.
- CRT mode remains legible (on/off).
- Mobile layout stable at ~375px.
- Existing frontend tests remain passing.

### Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test
```
Manual QA: NEON/AMBER parity, CRT on/off, desktop + 375px mobile, scroll/pagination unchanged, unread readability, keyboard focus visibility.

---

## Phase 2 — Frontend-Only UX Features

### Goal
Ship high-value micro-features with no backend changes.

### 2.1 Density Setting (Compact / Comfortable) ✅ Completed 2026-02-21
- Add persisted client setting `rostra-density`.
- Compact uses Phase 1 density defaults.
- Comfortable restores larger spacing/typography values.
- Apply via deterministic class/token branches (no new dependency).
- Keep latest-message context anchored on density toggle (snap to bottom to avoid upward drift).

### 2.2 Dynamic Browser Title ✅ Completed 2026-02-21
- Selected room: `#room-name - Rostra`.
- No selected room: `Rostra`.

### 2.3 Keyboard Shortcuts ✅ Completed 2026-02-21
- `/` opens/focuses search.
- `Escape` closes currently active panel/menu/modal.
- Must not fire while typing in inputs/textareas/content-editable controls.

### 2.4 Command Palette (Moved from prior Phase 3) ✅ Completed 2026-02-21
- `Cmd/Ctrl+K` opens room/action palette.
- Filter rooms and navigate on Enter.
- Include lightweight actions: create room, toggle theme, toggle CRT.
- Implement with existing modal patterns, no new dependency by default.

### 2.5 Mobile Back-Button Unread Indicator ✅ Completed 2026-02-21
- Show a small dot on the "Back to rooms" arrow in `MessageArea` when any other room has unread messages.
- Data already available in ChatLayout (`unreadCounts`) — pass total-unread-exists boolean down.
- Helps mobile users know there's activity in other rooms without leaving the current one.

### 2.6 Room Menu Overflow Guard ✅ Completed 2026-02-21
- Room options dropdown in `MessageArea` uses `absolute right-0` which can overflow on narrow viewports.
- Add `max-h` with scroll or reposition logic to keep menu on-screen.

### 2.7 Send Button Glyph Cleanup ✅ Completed 2026-02-21
- Replace triangle glyph with text-only SEND or icon+text (using existing `lucide-react`).
- Keep button labeling and semantics unchanged.

### 2.8 Optional: Notification Sound (Feature Flagged) ⏸ Deferred
- Only for background tab new messages (`document.hidden === true`).
- User-controlled persisted toggle `rostra-sound`.
- Defer if autoplay/browser policy friction creates unstable behavior.

### 2.9 Keyboard Tab Focus Flow (Addendum) ✅ Completed 2026-02-21
- First Tab from a focused room row jumps to composer input.
- Chat area tab order: input -> send -> back -> room menu -> search -> users.
- Shift+Tab follows reverse order where applicable.
- Follow-up note: current behavior is acceptable for now; revisit after possible sidebar/back-arrow redesign to refine desktop flow.

### 2.10 Room Header Alignment Polish (Addendum) ✅ Completed 2026-02-21
- Increase room-title size slightly.
- Improve vertical alignment against back/control icons in the header.

### 2.11 Message Input Placeholder Truncation (Addendum) ✅ Completed 2026-02-21
- Truncate very long room names in composer placeholder to prevent horizontal scrollbar behavior.
- Tighten truncation threshold so room-aware placeholder text still fits around 375px widths.

### 2.12 Desktop Collapsed Sidebar Expand Affordance (`R>`) ✅ Completed 2026-02-21
**Goal:** Make collapsed-sidebar expand/collapse intent obvious for desktop users without changing mobile behavior.

**Scope:**
- Desktop only (`md` and up). Mobile sidebar/backdrop behavior remains unchanged.
- Replace collapsed-state single `R` mark with explicit directional affordance (`R>` visual treatment).
- Expanded state keeps full `ROSTRA` branding and shows a clear collapse affordance.

**Intended interaction model:**
1. Collapsed desktop sidebar:
- Header control renders as one button with `R>` affordance.
- Clicking, Enter, or Space expands the sidebar.

2. Expanded desktop sidebar:
- Header row renders full `ROSTRA` plus collapse affordance.
- Clicking, Enter, or Space on collapse affordance collapses the sidebar.

3. Transition behavior:
- Width transition and logo/affordance transition happen together.
- Transition should feel like the `R>` expands into `ROSTRA`, and reverse on collapse.
- Keep motion subtle and fast (target ~180–240ms) with no visible flicker.
- No layout jank in the center chat area during toggle.

**Temporary layout adjustment (approved):**
- Move the `NEON` / `CRT` / `COMPACT` controls down to a separate row beneath the logo row.
- Render these controls horizontally for now so they are visually and interactively out of the way of the expand/collapse affordance.
- This is an interim layout decision pending a future dedicated settings modal.

**Accessibility requirements:**
- Control label updates between `Expand sidebar` and `Collapse sidebar`.
- Visible focus ring for keyboard users.
- Pointer hit area remains comfortably clickable in both states.

**Non-goals:**
- No backend/API changes.
- No new persistence/state settings.
- No changes to room list logic or command palette behavior.
- Do not redesign settings architecture in this task (future modal can supersede this temporary row layout).

**Open design choices to lock before implementation:**
- Arrow style: use icon-first approach (`ChevronRight`/`ChevronLeft`) with theme-consistent gradient/tint styling.
- Composition: use hybrid text + icon (Option 2) as the first implementation:
  - Collapsed: `R` + right chevron icon.
  - Expanded: `ROSTRA` + left chevron icon as a clear collapse control.
- Fallback (only if visual result is poor): revert to text-glyph variant (`R>` / `ROSTRA<`).

**Color reference (for future reuse):**
- Neon blue->magenta gradient midpoint accent: `#9069E2` (used for CRT toggle accent styling).

### Acceptance Criteria
- No backend/API changes.
- No regressions in search, messaging, or navigation.
- Shortcut handling deterministic and input-safe.
- Settings persist correctly across reloads.

---

## Phase 3 — Backend-Coupled Features (Approve Individually)

### Cross-Cutting Guardrails (applies to every Phase 3 item)
1. Authorization must be explicit and tested (member, sender-owner, room-owner paths).
2. Add rate limits to new write endpoints.
3. Keep cursor pagination behavior backward-compatible.
4. Maintain unread count consistency (Redis + DB fallback behavior).
5. Add/update WS event schemas and client handling with backward-safe parsing.
6. Include migration + downgrade for every schema change (never edit applied migrations).
7. Update `docs/ARCHITECTURE.md`, `backend/TESTPLAN.md`, and docs as part of each approved item.

### 3.1 New Messages Divider (Recommended First)
**Value:** High, low complexity.

How it works:
1. Room list response includes `last_read_at` for each joined room.
2. When user opens a room, frontend snapshots that room's `last_read_at` at open time.
3. `MessageList` inserts one `NEW MESSAGES` divider before the first message with `created_at > last_read_at_snapshot`.
4. Divider is not re-positioned while viewing the room; it is recomputed on next room entry.

Backend plan:
- Extend `RoomResponse` with optional `last_read_at: datetime | None`.
- Update `GET /api/rooms` mapper (both `include_unread` true/false paths) to return `last_read_at` from `user_room`.
- Ensure room query path returns membership row data needed for this field (no N+1).

Frontend plan:
- Extend `Room` type with optional `last_read_at`.
- In `ChatLayout`, pass room-open snapshot timestamp into `MessageList`.
- In `MessageList`, compute divider insertion in render loop (single divider max).

Files expected:
- `backend/app/schemas/room.py`
- `backend/app/api/rooms.py`
- `backend/app/crud/room.py`
- `frontend/src/types/index.ts`
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/MessageList.tsx`

Tests:
- Backend: rooms endpoint returns `last_read_at` for joined rooms.
- Frontend: divider appears for unread boundary, absent when all messages are read.
- Regression: divider does not duplicate across pagination loads.

Locked decisions for implementation (3.1):
- Divider label text: `NEW MESSAGES`.
- `last_read_at = null` behavior: do not render divider.

Implementation Ready Checklist (3.1):
- `Locked`: `RoomResponse` contract includes `last_read_at?: string | null` (ISO timestamp string or null).
- `Locked`: `last_read_at = null` behavior is no divider.
- `Locked`: Divider recompute strategy is snapshot on room open; no live reposition while viewing.
- `Locked`: Divider insertion rule is single divider before first `created_at > last_read_at_snapshot`.
- `Locked`: `ChatLayout` owns snapshot state and passes it to `MessageList`.
- `Locked`: Backend rooms query path returns `last_read_at` via membership join without N+1 queries.
- `Locked`: `backend/TESTPLAN.md` includes explicit 3.1 test assertions before implementation starts.

### 3.2 Global Jump-to-Message (Search -> Any Message in History)
**Value:** High.

Implementation slices:
- **3.2A Infrastructure:** Bidirectional context pagination (older + newer) and anchored-mode message loading primitives.
- **3.2B UX Behavior:** Search-result jump, target highlight, and live-update indicator behavior while anchored.
- Note: 3.2B depends on 3.2A. Do not implement 3.2B first.

How it works:
1. User clicks a search result.
2. Frontend requests message context around target message from backend.
3. Frontend replaces current message buffer with returned context window, scrolls target into view, and highlights target briefly.
4. User can continue loading older *and newer* messages from that anchored context.
5. While user is not at latest, incoming live messages are surfaced via indicator and do not break anchored context.

Backend plan:
- Add endpoint (recommended): `GET /api/rooms/{room_id}/messages/{message_id}/context?before=25&after=25`.
- Validate room exists, message exists in room, and requester is a room member.
- Response includes:
- ordered messages (oldest -> newest in payload),
- `target_message_id`,
- cursor for older history,
- cursor for newer history.
- Keep existing `/messages` and `/messages/search` unchanged.

Frontend plan:
- Add `getMessageContext(...)` in API client.
- Wire search-result click -> context fetch -> message list anchor mode.
- Add temporary highlight state keyed by `target_message_id`.
- Extend `MessageList` pagination model to support both older and newer loading in context mode:
- top sentinel loads older using `older_cursor`,
- bottom sentinel loads newer using `newer_cursor`.
- Add context-mode live update indicator:
- when WS `new_message` arrives and viewer is not at latest, show a non-blocking "new messages available" affordance,
- allow user to jump to latest explicitly,
- once latest is reached, resume normal append-to-bottom behavior.

Files expected:
- `backend/app/api/messages.py`
- `backend/app/crud/message.py`
- `backend/app/schemas/message.py`
- `frontend/src/services/api.ts`
- `frontend/src/components/SearchResults.tsx`
- `frontend/src/components/SearchPanel.tsx`
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/MessageList.tsx`
- `frontend/src/types/index.ts`

Tests:
- Backend: context endpoint authz/membership/not-found branches.
- Backend: context window and cursors are stable and ordered.
- Frontend: click search result jumps/highlights even when message is not currently loaded.
- Frontend: after jump, scrolling up loads older and scrolling down loads newer until latest.
- Frontend: live updates indicator appears when anchored away from latest and clears when latest is reached.
- Regression: normal room entry and infinite scroll behavior remains unchanged.

Locked decisions for implementation (3.2):
- Default context window: `before=25`, `after=25`.
- Route strategy for v1: internal context loading only (no deep-link route in this feature).
- Context-mode pagination: bidirectional required (`top => older`, `bottom => newer`).
- Live updates while anchored: non-blocking indicator + explicit jump-to-latest; no forced auto-jump.

Implementation Ready Checklist (3.2):
- `Locked`: Context endpoint response schema is:
  - `messages` (ordered oldest -> newest),
  - `target_message_id`,
  - `older_cursor`,
  - `newer_cursor`.
- `Locked`: Cursor semantics are strict keyset boundaries with stable tie-break `(created_at, id)`:
  - `older_cursor` fetches strictly older than oldest loaded row,
  - `newer_cursor` fetches strictly newer than newest loaded row.
- `Locked`: Default context window is `before=25`, `after=25`.
- `Locked`: Frontend mode/state model is explicit `normal` vs `context` mode with owner state in `ChatLayout`.
- `Locked`: Sentinel behavior in context mode is `top=>older`, `bottom=>newer`.
- `Locked`: Live updates while anchored show non-blocking indicator text `New messages available` + explicit jump-to-latest action; no forced auto-jump.
- `Locked`: Exit conditions from context mode are:
  - user triggers jump-to-latest,
  - room switch,
  - `newer_cursor` exhausted and user reaches bottom edge (now at latest).
- `Locked`: Failure handling is:
  - context `403/404`: keep current buffer, show non-blocking inline error in search panel,
  - stale cursor `400`: one automatic context refetch around current target, then inline error if refetch fails,
  - network failure: retry action available in the invoking panel/context UI.
- `Locked`: Regression contract is unchanged normal history behavior outside context mode.
- `Locked`: 3.2A/3.2B branch split and merge order is mandatory (`3.2A` first).

Delivery sequence for 3.2:
1. **3.2A:** Ship backend + frontend bidirectional context pagination primitives with tests.
2. **3.2B:** Ship search-click jump/highlight and live-update indicator UX on top of 3.2A.

### 3.3 Message Editing
**Value:** High.

How it works:
1. Message owner enters inline edit mode for their message.
2. Edit is submitted via `PATCH`.
3. Backend updates message content, sets `edited_at`, and broadcasts WS update.
4. All clients update message content in place and show `(edited)`.

Backend plan:
- Add nullable `edited_at` column to `messages`.
- Add `PATCH /api/messages/{message_id}` endpoint (owner-only authz).
- Reuse message content validation rules (trim + 1..1000 chars).
- Return updated message payload including `edited_at`.
- Add WS event `message_edited` with updated fields.
- Add edit endpoint rate limit: `20/minute` per user.

Frontend plan:
- Add edit affordance on own messages only.
- Inline textarea with save/cancel (`Enter` save, `Escape` cancel).
- Render `(edited)` in message metadata when `edited_at` exists.
- Hover behavior:
- hovering the original timestamp shows original `created_at` detail,
- hovering the `(edited)` marker shows `edited_at` detail.
- Handle `message_edited` WS event in `ChatLayout`/`MessageList`.

Files expected:
- `backend/app/models/message.py`
- `backend/app/schemas/message.py`
- `backend/app/crud/message.py`
- `backend/app/api/messages.py`
- `backend/app/websocket/schemas.py`
- `backend/app/websocket/handlers.py`
- `frontend/src/types/index.ts`
- `frontend/src/context/webSocketContextState.ts`
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/MessageList.tsx`

Tests:
- Backend: owner can edit; non-owner forbidden; validation errors.
- Backend: `edited_at` set and returned.
- Frontend: inline edit UX + WS updates reflected.

Locked decisions for implementation (3.3):
- Edit window policy: unlimited.
- Timestamp semantics: keep original `created_at` + `(edited)` marker.
- Hover semantics: original timestamp hover shows `created_at`; `(edited)` marker hover shows `edited_at`.
- Authorization policy: owner only.
- Deleted messages editability: cannot edit deleted messages.
- No-op edit policy: reject when trimmed content is unchanged.
- Validation policy: same as message-create validation (trimmed, 1..1000 chars).
- Conflict policy: last-write-wins in v1.
- Client update model: server-authoritative (no optimistic final state).
- WS event contract: include `message_id`, `room_id`, `content`, `edited_at`.
- Rate limit: `20/minute` on edit endpoint.

Implementation Ready Checklist (3.3):
- `Locked`: Endpoint is owner-only and returns 403 for non-owner edits.
- `Locked`: Edit endpoint rejects no-op edits after trimming.
- `Locked`: Edit endpoint enforces same content validation bounds as message create.
- `Locked`: Deleted messages cannot be edited.
- `Locked`: Frontend renders `(edited)` marker with separate hover timestamp behavior.
- `Locked`: Frontend preserves original timestamp display next to edited marker.
- `Locked`: WS event applies in-place content+edited_at update without reordering message.
- `Locked`: Endpoint rate limit is set to `20/minute`.
- `Locked`: Backend and frontend tests for all above are listed in `backend/TESTPLAN.md` and frontend component tests before implementation.

### 3.4 Message Deletion
**Value:** High.

How it works:
1. Authorized user deletes a message.
2. Backend soft-deletes message (`deleted_at`), removes searchable content, broadcasts WS event.
3. Clients render a tombstone row in place of original content.

Backend plan:
- Add nullable `deleted_at` column to `messages`.
- On delete:
- set `deleted_at`,
- replace `content` with empty string (or fixed tombstone token) so search vector no longer matches original text.
- Add `DELETE /api/messages/{message_id}` endpoint.
- Authz: message owner + room creator can delete.
- Exclude deleted rows from search endpoint results.
- Add WS event `message_deleted`.

Frontend plan:
- Show delete affordance for authorized users.
- Confirm before delete.
- Render deleted message tombstone style in list.
- Tombstone copy/presentation: `(deleted)` in smaller muted/grey text.
- Ignore edit/reaction actions on deleted rows.
- Handle `message_deleted` WS event to update local list in place.

Files expected:
- `backend/app/models/message.py`
- `backend/app/schemas/message.py`
- `backend/app/crud/message.py`
- `backend/app/api/messages.py`
- `backend/app/websocket/schemas.py`
- `backend/app/websocket/handlers.py`
- `frontend/src/types/index.ts`
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/MessageList.tsx`

Tests:
- Backend: delete authz matrix; deleted message excluded from search.
- Frontend: tombstone render and WS sync.
- Regression: pagination ordering unaffected.

Locked decisions for implementation (3.4):
- Delete authorization: message owner + room creator.
- Deletion model: soft delete only (`deleted_at`), no hard delete in v1.
- Content scrubbing: overwrite stored `content` to empty string on delete.
- Timeline behavior: keep row in history; do not remove or reorder row.
- Tombstone presentation: `(deleted)` rendered as smaller muted/grey text.
- Search behavior: deleted messages are excluded from search results.
- DELETE response semantics: `204 No Content`, idempotent for already-deleted messages (authorized caller).
- WS payload contract: `message_deleted` includes `room_id`, `message_id`, `deleted_at`.
- Frontend WS handling: mutate row in place to deleted state.
- Rate limit: `20/minute` on delete endpoint.
- Post-delete restrictions: deleted messages are not editable and not reactable.

Implementation Ready Checklist (3.4):
- `Locked`: endpoint authz matrix enforces owner+creator policy.
- `Locked`: endpoint performs soft delete only and sets `deleted_at`.
- `Locked`: endpoint scrubs content and prevents deleted rows from appearing in search.
- `Locked`: endpoint is idempotent for already-deleted rows and returns `204` for authorized caller.
- `Locked`: WS `message_deleted` event includes required fields for in-place update.
- `Locked`: frontend renders `(deleted)` in smaller muted style and keeps row position stable.
- `Locked`: frontend disables edit/reaction actions on deleted messages.
- `Locked`: delete endpoint rate limit is set to `20/minute`.
- `Locked`: backend/frontend tests for the above are listed before implementation starts.

### 3.5 Message Reactions
**Value:** Medium-high.

How it works:
1. User toggles an emoji reaction on a message.
2. Backend upserts/removes reaction row and broadcasts delta event.
3. Clients update aggregated reaction pills in real time.

Backend plan:
- Add `message_reactions` table:
- columns: `id`, `message_id`, `user_id`, `emoji`, `created_at`,
- unique constraint on (`message_id`, `user_id`, `emoji`),
- indexes on `message_id`, `user_id`.
- Add endpoints:
- `POST /api/messages/{message_id}/reactions` (add),
- `DELETE /api/messages/{message_id}/reactions/{emoji}` (remove own).
- Include reaction summary in message payloads (count + reacted_by_me).
- Add WS events `reaction_added` and `reaction_removed`.

Frontend plan:
- Add reaction bar under each message.
- Fixed starter emoji set (no full picker in v1): `👍 👎 ❤️ 😂 🔥 👀 🎉`.
- Toggle own reaction on click.
- Apply WS delta updates without full refetch.

Files expected:
- `backend/app/models/` (new reaction model)
- `backend/app/schemas/message.py` (reaction summary)
- `backend/app/crud/message.py` (aggregation + mutation helpers)
- `backend/app/api/messages.py`
- `backend/app/websocket/schemas.py`
- `backend/app/websocket/handlers.py`
- Alembic migration
- `frontend/src/types/index.ts`
- `frontend/src/components/MessageList.tsx`
- `frontend/src/components/ChatLayout.tsx`

Tests:
- Backend: unique constraint and toggle semantics.
- Backend: summary aggregation correctness.
- Frontend: pill rendering and real-time updates.

Locked decisions for implementation (3.5):
- Emoji allowlist for v1: `👍 👎 ❤️ 😂 🔥 👀 🎉`.
- Per-user reaction model: user may react with multiple different emojis on the same message, once per emoji.
- Authorization: any authenticated room member may add/remove own reactions.
- Deleted-message behavior: deleted messages are non-reactable, show no reaction UI, and their stored reactions are removed when message is deleted.
- Reaction overflow behavior: show up to 5 pills inline, then `+N`.
- Pill ordering: count descending; tie-break by allowlist order.
- API shape: explicit add/remove endpoints (`POST` add, `DELETE` remove); client composes toggle behavior.
- WS payload contract: reaction events include `room_id`, `message_id`, `emoji`, `user_id`, and updated emoji `count`.
- Client update model: server-authoritative updates; no optimistic final state.
- Rate limit: `40/minute` on reaction endpoint family.

Implementation Ready Checklist (3.5):
- `Locked`: emoji set includes both `👍` and `👎` in v1 starter reactions.
- `Locked`: duplicate same-emoji reaction by same user is prevented by unique constraint and treated as toggle via add/remove API usage.
- `Locked`: non-room-members cannot react; users can only remove their own reactions.
- `Locked`: deleted messages cannot be reacted to and render without reaction controls.
- `Locked`: deleting a message removes its stored reactions.
- `Locked`: UI shows max 5 pills inline and then `+N` overflow indicator.
- `Locked`: reaction pills sort by count desc with allowlist-order ties.
- `Locked`: WS reaction events carry required fields for deterministic in-place updates.
- `Locked`: client applies server-authoritative state from API+WS and does not assume optimistic final state.
- `Locked`: reaction rate limit is set to `40/minute`.
- `Locked`: backend/frontend tests for the above are listed in `backend/TESTPLAN.md` and frontend test plan before implementation starts.

### 3.6 Room Descriptions (Optional)
**Value:** Medium.

How it works:
1. Room creator can add/edit a short room description.
2. Description appears in room header and discovery surfaces.

Backend plan:
- Add nullable `description` to `rooms`.
- Extend `RoomCreate` and `RoomResponse` with optional description.
- Add creator-only room update endpoint for description/name edits.
- Validate and trim (max `255` chars, no newline characters in v1).
- Treat empty string after trim as clear (`description = null`).
- Broadcast room metadata update event after successful update.

Frontend plan:
- Show description below room title in chat header using smaller font than room title.
- Show description in room discovery modal/list.
- Mobile behavior: truncate description and show explicit `...` button to expand/collapse full text.
- Provide creator-only edit entry point.
- Apply server-authoritative updates from API/WS (no optimistic final-state assumption).

Files expected:
- `backend/app/models/room.py`
- `backend/app/schemas/room.py`
- `backend/app/crud/room.py`
- `backend/app/api/rooms.py`
- Alembic migration
- `frontend/src/types/index.ts`
- `frontend/src/components/MessageArea.tsx`
- `frontend/src/components/RoomDiscoveryModal.tsx`

Tests:
- Backend: creator-only update, validation boundaries.
- Frontend: display fallback when description missing.
- Frontend: mobile truncate/expand behavior for description.

Locked decisions for implementation (3.6):
- API shape: single creator-only `PATCH /api/rooms/{room_id}` updates both `name` and `description`.
- Content type: plain text only (no markdown/rich text) in v1.
- Max length: `255` characters.
- Normalization: trim leading/trailing whitespace, preserve internal spaces, reject newline characters in v1.
- Empty semantics: empty string after trim clears description (`null` in DB).
- Authorization: room creator only.
- Visibility surfaces: room header + room discovery list only (no additional v1 surfaces).
- Mobile rendering: smaller description text; truncated by default on mobile with explicit `...` expand/collapse control.
- Realtime propagation: room metadata update is broadcast via WS so connected clients update without reload.
- Client update model: server-authoritative updates from API + WS.
- Rate limit: `20/minute` on room update endpoint.

Implementation Ready Checklist (3.6):
- `Locked`: single creator-only `PATCH /api/rooms/{room_id}` handles `name` and `description`.
- `Locked`: description validation enforces plain text, max `255`, and no newlines.
- `Locked`: trim + clear semantics (`""` after trim => `null`) are implemented consistently.
- `Locked`: non-creators cannot modify description.
- `Locked`: description appears in header and discovery list only.
- `Locked`: mobile renders truncated description with explicit `...` expand/collapse control.
- `Locked`: description style is visually subordinate to room title (smaller font).
- `Locked`: WS update event propagates metadata changes to all connected clients.
- `Locked`: frontend applies server-authoritative room metadata updates.
- `Locked`: room update endpoint rate limit is set to `20/minute`.
- `Locked`: backend/frontend tests for all above are listed in `backend/TESTPLAN.md` and frontend test plan before implementation starts.

### 3.7 Parking Lot (Defer)
- URL permalink/deep-link route support (separate from internal jump, higher complexity).
- User bio/status profile expansion (lower immediate UX value vs cost).

---

## Phase 3 Decision Locks

Use this section as the implementation gate. Detailed lock rationale and acceptance checklists live in each feature section above.

| Feature | Status | Locked on | Scope snapshot |
| --- | --- | --- | --- |
| `3.1` New Messages Divider | `Locked` | `2026-02-21` | `NEW MESSAGES`; do not render when `last_read_at` is null. |
| `3.2` Global Jump-to-Message | `Locked` | `2026-02-21` | Internal-only context jump; default `25/25` window; required bidirectional context pagination; non-blocking live indicator + jump-to-latest; `3.2A` before `3.2B`. |
| `3.3` Message Editing | `Locked` | `2026-02-21` | Owner-only; no time limit; keep original timestamp + `(edited)` marker with separate hovers; no deleted edits; no-op rejected; server-authoritative LWW; rate limit `20/minute`. |
| `3.4` Message Deletion | `Locked` | `2026-02-21` | Owner + room creator; soft delete + content scrub; `(deleted)` muted tombstone in place; excluded from search; idempotent `204`; server event sync; rate limit `20/minute`. |
| `3.5` Message Reactions | `Locked` | `2026-02-22` | Allowlist `👍 👎 ❤️ 😂 🔥 👀 🎉`; multi-emoji per user (one per emoji); member-only; no deleted-message reactions; max 5 pills + `+N`; server-authoritative; rate limit `40/minute`. |
| `3.6` Room Descriptions | `Locked` | `2026-02-22` | Creator-only single room `PATCH` for name+description; plain text max `255`; trim/no newlines; empty clears to null; header+discovery surfaces; mobile truncate + `...`; server-authoritative; rate limit `20/minute`. |

Lock maintenance rule:
- If a lock changes, update both this matrix and the corresponding `Locked decisions` + `Implementation Ready Checklist` in the feature section.

---

## Priority Order (Recommended)
1. Phase 1 cosmetic pass.
2. Phase 2.1 density + 2.2 browser title.
3. Phase 2.3 shortcuts + 2.4 command palette.
4. Phase 2.12 desktop collapsed sidebar `R>` affordance.
5. Phase 3.1 new messages divider.
6. Phase 3.2A bidirectional context pagination infrastructure.
7. Phase 3.2B global jump-to-message UX (search click + highlight + live-update indicator).
8. Phase 3.3 editing.
9. Phase 3.4 deletion.
10. Phase 3.5 reactions.
11. Phase 3.6 room descriptions.
12. Parking lot items only with explicit product demand.

---

## Cross-Phase Test Scenarios
1. Readability with long usernames, long room names, and dense streams.
2. Theme parity in NEON and AMBER with CRT on/off.
3. Keyboard-only usage and predictable focus order.
4. Mobile panel overlap and discoverability.
5. Regression checks for scroll, unread counts, search debounce/abort, send flow.
6. Desktop sidebar collapsed/expanded affordance is obvious and keyboard-accessible; mobile behavior unchanged.
7. For Phase 3: deep-history jump targets resolve correctly and preserve pagination behavior.
8. For Phase 3: WS event handling must not regress existing message flow.

---

## Documentation Plan per Implemented Phase
1. Update status markers in this file.
2. Update `docs/PATTERNS.md` for new reusable patterns.
3. Update `docs/REVIEW_CHECKLIST.md` if new recurring checks are needed.
4. Update `docs/ARCHITECTURE.md` for any API/schema/WS contract change.
5. Update `backend/TESTPLAN.md` before writing tests for approved features.
6. Add ADR for non-obvious architectural decisions (for example, soft delete policy).

---

## Assumptions and Defaults
1. This file is the single source of truth for design rollout.
2. Readability is prioritized while preserving retro identity.
3. Phase 1 remains strictly cosmetic.
4. Phase 2 remains frontend-only.
5. Phase 3 items require separate approval before implementation.
6. No implementation starts without explicit approval for the selected phase/item.
