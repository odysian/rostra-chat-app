# Frontend Design Audit and Phased Roadmap — Rostra

**Date:** 2026-02-21
**Status:** Phase 2 completed on 2026-02-21 (2.1-2.7 and 2.9-2.12 complete, 2.8 deferred). Phase 3 pending.
**Canonical file:** `docs/frontend-design-audit.md`

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

Backend:
- Extend room payload to include current-user `last_read_at` where missing.

Frontend:
- Insert `NEW MESSAGES` divider at first message newer than `last_read_at`.
- Divider clears naturally when room is marked read.

### 3.2 Global Jump-to-Message (Search -> Any Message in History)
**Value:** High.

Backend:
- Add a message-context endpoint for a target message (recommended shape: `GET /api/rooms/{room_id}/messages/{message_id}/context?before=25&after=25` with cursors for continued paging).
- Validate room membership and target message existence in that room.
- Return enough context to render the target in place and continue paginating in both directions.
- Keep existing history endpoints backward-compatible.

Frontend:
- Search result click requests target context when message is outside current buffer.
- Navigate to target message, center/scroll it into view, and apply temporary highlight.
- Preserve existing message list behavior for normal scrolling/loading.

Open decisions:
- Final context window size defaults.
- Whether to introduce a dedicated route for target message navigation in this phase.

### 3.3 Message Editing
**Value:** High.

Backend:
- Add `edited_at` column on messages.
- `PATCH /api/messages/{message_id}` for message owner.
- Update search vector/content path on edit.
- Emit `message_edited` WS event.

Frontend:
- Inline edit mode for own messages.
- `(edited)` marker near timestamp.
- WS-driven in-place update.

Open decisions:
- Edit window limit (none vs time-boxed).

### 3.4 Message Deletion
**Value:** High.

Backend:
- Soft-delete approach: add `deleted_at`; scrub/replace content consistently.
- `DELETE /api/messages/{message_id}` for owner and optionally room creator.
- Exclude deleted content from search results.
- Emit `message_deleted` WS event.

Frontend:
- Delete action with confirmation.
- Render consistent tombstone text style.
- WS-driven in-place update.

Open decisions:
- Room creator delete authority scope.

### 3.5 Message Reactions
**Value:** Medium-high.

Backend:
- Add `message_reactions` table with unique `(message_id, user_id, emoji)`.
- Indexes on `message_id` and `user_id`.
- Add reaction add/remove endpoints.
- Include summarized reactions on message payload.
- Emit `reaction_added` and `reaction_removed` WS events.

Frontend:
- Reaction pills with counts.
- Small fixed emoji set initially.
- Toggle own reaction quickly.

Open decisions:
- Final emoji set and per-message cap.

### 3.6 Room Descriptions (Optional)
**Value:** Medium.

Backend:
- Add `description` on rooms.
- Extend room create/update contracts with validation.

Frontend:
- Display description in room header/discovery UI.
- Creator-only editing path.

### 3.7 Parking Lot (Defer)
- URL permalink/deep-link route support (separate from internal jump, higher complexity).
- User bio/status profile expansion (lower immediate UX value vs cost).

---

## Priority Order (Recommended)
1. Phase 1 cosmetic pass.
2. Phase 2.1 density + 2.2 browser title.
3. Phase 2.3 shortcuts + 2.4 command palette.
4. Phase 2.12 desktop collapsed sidebar `R>` affordance.
5. Phase 3.1 new messages divider.
6. Phase 3.2 global jump-to-message.
7. Phase 3.3 editing.
8. Phase 3.4 deletion.
9. Phase 3.5 reactions.
10. Phase 3.6 room descriptions.
11. Parking lot items only with explicit product demand.

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
