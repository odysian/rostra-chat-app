## Goal
Implement Phase 3.2 **Global Jump-to-Message** end-to-end for room history search navigation, including:
- 3.2A infrastructure: bidirectional context pagination + anchored-mode primitives.
- 3.2B UX behavior: search-result jump, target highlight, and anchored live-update indicator.

This Task is executed in `single` mode, with mandatory internal delivery order `3.2A` before `3.2B`.

Suggested labels: `type:task`, `area:frontend`, `area:backend`, `area:ws`, `area:tests`, `area:docs`, `phase:3`, `status:ready`

## Scope
**In:**
- Add context endpoint: `GET /api/rooms/{room_id}/messages/{message_id}/context?before=25&after=25`.
- Return ordered context payload with `target_message_id`, `older_cursor`, `newer_cursor`.
- Add frontend context mode (`normal` vs `context`) in `ChatLayout`.
- Implement bidirectional loading in context mode (`top => older`, `bottom => newer`).
- Wire search result click to context jump.
- Add temporary target highlight.
- Add non-blocking anchored live-update indicator with explicit jump-to-latest.
- Preserve existing normal history behavior.

**Out:**
- Deep-link routing/permalink behavior.
- Forced auto-jump to latest on incoming messages.
- Changes to existing `/messages` and `/messages/search` contracts.
- New dependencies.

## Implementation Notes
1. **3.2A backend first**
- Add context query path with strict membership authz and room/message validation.
- Enforce stable keyset cursor semantics using `(created_at, id)` tie-break.
- Keep response ordered `oldest -> newest`.

2. **3.2A frontend primitives**
- Introduce explicit context-mode state ownership in `ChatLayout`.
- Extend `MessageList` to load both directions in context mode.
- Keep normal mode pagination/append behavior unchanged.

3. **3.2B behavior layer**
- Search click triggers context fetch and anchor enter.
- Scroll target into view + transient highlight.
- While anchored away from latest, show `New messages available` indicator and jump-to-latest action.

4. **Failure handling contract**
- `403/404`: keep current buffer and show non-blocking inline error in search panel.
- Stale cursor `400`: one automatic context refetch around target, then inline error if retry fails.
- Network failures: provide retry action in invoking UI.

## Decision Locks (backend-coupled)
- [x] Locked: Default context window is `before=25`, `after=25`.
- [x] Locked: Internal context loading only for v1 (no deep-link route).
- [x] Locked: Context response schema includes `messages`, `target_message_id`, `older_cursor`, `newer_cursor`.
- [x] Locked: Cursor boundaries are strict and stable with keyset tie-break `(created_at, id)`.
- [x] Locked: Explicit frontend mode model (`normal` vs `context`) owned by `ChatLayout`.
- [x] Locked: Context sentinel behavior is `top => older`, `bottom => newer`.
- [x] Locked: Anchored live updates are non-blocking with explicit jump-to-latest (no forced auto-jump).
- [x] Locked: Context mode exit conditions are room switch, explicit jump-to-latest, or reaching latest via exhausted `newer_cursor` + bottom edge.
- [x] Locked: Regression contract preserves normal room history behavior outside context mode.
- [x] Locked: Delivery order is mandatory: `3.2A` merge complete before `3.2B`.

## Deviation Note (UX)
- Date: `2026-02-22`
- Reason: improve continuity after search jumps so users can keep scrolling naturally without mode-flip surprise at the bottom edge.
- Deviation from lock: removed automatic context exit when `newer_cursor` is exhausted and viewer reaches bottom.
- Current behavior: context mode remains active until explicit jump-to-latest action or room switch; while context is already at latest and user is near bottom, new incoming messages append directly.
- Follow-up: update canonical 3.2 lock text in `docs/specs/frontend-design-audit.md` if this behavior is accepted as the new default.

## Acceptance Criteria
- [x] Backend context endpoint enforces room membership authz and returns ordered context payload with stable older/newer cursors.
- [x] Context loading supports bidirectional pagination from an anchored target message (`older` at top, `newer` at bottom).
- [x] Clicking a search result jumps to message context even when target message is not currently loaded.
- [x] Target message receives temporary highlight after jump.
- [x] While anchored away from latest, incoming WS messages do not break context and show a non-blocking `New messages available` indicator.
- [x] User can explicitly jump to latest and resume normal append behavior.
- [x] Existing `/messages` and `/messages/search` behavior remains unchanged.
- [x] Backend tests cover authz, not-found, ordering, cursor semantics.
- [x] Frontend tests cover jump/highlight, bidirectional loading, anchored live indicator behavior.
- [x] Required docs updated in same PR: `docs/ARCHITECTURE.md`, `backend/TESTPLAN.md`, and any touched patterns/checklists.

## Verification
```bash
make backend-verify
make backend-verify SKIP_DB_BOOTSTRAP=1
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [x] Docs updated if needed (`docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`, `backend/TESTPLAN.md`, `docs/adr/`).
- [x] Tests added/updated where needed.
