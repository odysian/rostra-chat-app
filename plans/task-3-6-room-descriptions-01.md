## Goal
Deliver Phase 3.6 Room Descriptions end-to-end (DB + API + WS + frontend) with creator-only edits and server-authoritative metadata updates.

Suggested labels: `type:task`, `phase:3`, `area:backend`, `area:frontend`, `area:db`, `area:ws`, `area:tests`, `area:docs`, `status:ready`

## Scope
**In:**
- Add nullable `description` to `rooms` with migration support.
- Extend room create/read schemas to include optional description.
- Add a creator-only room metadata update endpoint (`name` + `description`).
- Enforce description normalization and validation (`trim`, max `255`, no newlines, empty clears to `null`).
- Broadcast room metadata updates to connected clients over WebSocket.
- Show descriptions in room header and room discovery list only.
- Add mobile-safe room header behavior so description does not overlap the room name.
- Add backend/frontend tests for authz, validation, and UI behavior.

**Out:**
- Markdown/rich-text descriptions.
- Any additional description surfaces outside header + discovery list.
- Optimistic final-state assumptions for room metadata updates.
- Non-3.6 feature work.

## Implementation Notes
1. Keep API shape as one creator-only endpoint: `PATCH /api/rooms/{room_id}` for both `name` and `description`.
2. Normalize input consistently for both create/update paths so storage behavior matches lock semantics.
3. Reuse existing room event delivery pattern so metadata updates are applied without page reload.
4. Preserve server authority: API responses and WS events are the source of truth for room metadata state.
5. On mobile, stack room name/description and use truncation + hover title for full text.

## Decision Locks
- [x] Locked: execution mode is `single` (one Task -> one PR).
- [x] Locked: API uses one creator-only `PATCH /api/rooms/{room_id}` for `name` + `description`.
- [x] Locked: description is plain text only in v1.
- [x] Locked: description max length is `255`.
- [x] Locked: normalization trims leading/trailing whitespace, preserves internal spaces, and rejects newline characters.
- [x] Locked: empty string after trim clears description (`null` in DB).
- [x] Locked: only room creator can update room metadata.
- [x] Locked: description appears only in room header and room discovery list.
- [x] Locked: mobile header stacks room name + description and truncates description by container width with full text available via hover title.
- [x] Locked: room metadata updates propagate via WS so connected clients update live.
- [x] Locked: frontend update model is server-authoritative (API + WS, no optimistic final-state assumptions).
- [x] Locked: room update endpoint is rate-limited at `20/minute`.
- [x] Locked: backend/frontend tests for these constraints are listed before implementation.

## Acceptance Criteria
- [x] `rooms.description` exists as nullable persisted column with migration.
- [x] `RoomCreate` accepts optional description with locked validation semantics.
- [x] Room response payloads include optional description.
- [x] Creator-only `PATCH /api/rooms/{room_id}` updates `name` and/or `description`.
- [x] PATCH validation enforces plain text, max `255`, no newline characters, and trim/clear semantics.
- [x] Non-creators cannot update room metadata.
- [x] Room metadata updates are rate-limited at `20/minute`.
- [x] WS event propagates room metadata updates to connected clients.
- [x] Chat header renders room description in a visually subordinate style.
- [x] Discovery list renders room description with expected fallback when missing.
- [x] Mobile header avoids overlap by stacking name/description and truncates description cleanly for narrow widths, with full text available via hover title.
- [x] Frontend applies server-authoritative metadata updates from API + WS.
- [x] Backend/frontend tests cover creator-only authz, validation boundaries, WS propagation, and mobile truncation behavior.
- [x] Required docs are updated for schema/API/WS/pattern changes.

## Verification
```bash
# Backend
make backend-verify

# Frontend
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [ ] Backend and frontend tests added/updated for room description behavior.
- [ ] Docs updated where required (`docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`, `backend/TESTPLAN.md`, `docs/adr/`).
