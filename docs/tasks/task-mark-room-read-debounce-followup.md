# Task Spec: Debounce `markRoomRead` While Room Is Active

**Date:** 2026-02-22
**Status:** Draft (follow-up task; out of scope for current Phase 3.1 implementation)
**Related context:** Phase 3.1 New Messages Divider (`last_read_at` snapshot behavior)

## Summary
The current chat flow calls `PATCH /api/rooms/{room_id}/read` on room open and on each incoming message while the room is selected. This is functionally correct, but can produce unnecessary request volume in high-traffic rooms.

This follow-up task adds a client-side debounce/batching layer for active-room read acknowledgements while preserving correctness of unread counts and divider-on-reentry behavior.

## Value / User Impact
- Lower network chatter during message bursts.
- Reduced backend write/cache churn on read updates.
- No visible UX regression for unread badges or room re-entry divider behavior.

## In Scope
- Debounce `markRoomRead` calls triggered by incoming messages for the currently selected room.
- Preserve immediate local UX state updates (do not delay message rendering).
- Add flush conditions to avoid dropping pending read updates (e.g., room switch, tab hidden, unmount).
- Add/update frontend tests for debounce/flush behavior.

## Out of Scope
- Backend schema/API contract changes.
- Redis model changes.
- Reworking unread counter architecture.
- Changing Phase 3.1 divider semantics (still snapshot on room entry, no live reposition).

## Expected Behavior
1. On room open, keep immediate `markRoomRead` call (baseline behavior remains).
2. While selected room receives incoming messages, enqueue/read-ack updates and send at most once per debounce window per room.
3. If user switches rooms, logs out, tab becomes hidden, or component unmounts, flush pending read ack for active room.
4. On failure, preserve current non-blocking behavior and retry on next scheduled/triggered read update.
5. Divider behavior remains unchanged: re-entry uses latest known read marker and session anchor remains stable.

## Compatibility Needs
- Must remain compatible with existing `markRoomRead` API response shape: `{ status, room_id, last_read_at }`.
- Must coexist with current `lastReadAtByRoomId` cache in `ChatLayout`.
- Must not interfere with WebSocket subscription logic or unread count updates.

## Risks
- Debounce window too long may delay server-side read marker updates enough to briefly stale unread badges across sessions.
- Missing flush paths may drop final read update when leaving a room.
- Per-room timers can leak if not cleaned up correctly.

## Backend Plan
No backend code changes expected.

## Frontend Plan
- Add a small per-room debounce scheduler in `ChatLayout` for active-room read acks.
- Keep room-open read path immediate.
- Use explicit flush helper invoked on:
  - room switch
  - room leave/delete
  - logout
  - visibilitychange (hidden)
  - component unmount cleanup
- Keep `lastReadAtByRoomId` updated from successful responses.

## Files Expected
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/__tests__/MessageArea.test.tsx` (if behavior surfaced via area integration)
- `frontend/src/components/__tests__/MessageList.test.tsx` (regression check for divider behavior)
- `frontend/src/services/api.ts` (only if typing/contracts need explicit helper type export)

## Tests / Regression Notes
- Add test: incoming burst triggers one debounced `markRoomRead` call, not one per message.
- Add test: pending read ack flushes on room switch.
- Add test: pending read ack flushes on unmount/logout path.
- Regression: divider behavior remains snapshot-stable and re-entry-correct.

## Decision Locks
- [ ] Locked: debounce window value (recommended start: 1000ms).
- [ ] Locked: room-open path remains immediate (not debounced).
- [ ] Locked: flush events list (room switch, leave/delete, logout, hidden, unmount).
- [ ] Locked: retry strategy remains non-blocking best-effort (no blocking UI).

## Acceptance Criteria
- [ ] Active-room incoming bursts do not emit `markRoomRead` per-message.
- [ ] Final read marker is flushed on room-exit and lifecycle flush triggers.
- [ ] No regression in unread badge behavior or room re-entry divider behavior.
- [ ] Frontend tests cover debounce and flush paths.
- [ ] Frontend verify commands pass.

## Verification Commands
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run test -- --run
cd frontend && npm run build
```

## Notes for Future Issue Creation
Use this file as the issue body seed for a single-mode Task issue:
- Suggested labels: `type:task`, `area:frontend`, `area:tests`, `phase:3`
- Suggested title: `Task: Debounce active-room markRoomRead calls`
