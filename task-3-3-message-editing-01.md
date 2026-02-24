## Goal
Implement Phase 3.3 **Message Editing** end-to-end in `single` mode (one Task -> one PR), after Message Deletion lands.

Suggested labels: `type:task`, `area:backend`, `area:frontend`, `area:ws`, `area:db`, `area:tests`, `area:docs`, `phase:3`, `status:ready`

## Dependency
- Depends on #28 (Phase 3.4 Message Deletion Task) for soft-delete model and deleted-message restrictions.

## Scope
**In:**
- Add nullable `edited_at` to `messages` via Alembic migration.
- Add `PATCH /api/messages/{message_id}` endpoint (owner-only).
- Reuse message-create validation (trim + 1..1000 chars).
- Reject no-op edits after trimming with `409 Conflict`.
- Reject edits to deleted messages.
- Keep original `created_at` semantics; add `(edited)` marker using `edited_at`.
- Add edit keyboard behavior:
  - `Enter` save
  - `Shift+Enter` newline
  - `Escape` cancel
- Add WS event `message_edited` using existing `{ type, message }` envelope:
  - `type = "message_edited"`
  - `message = { id, room_id, content, edited_at }`
- Server-authoritative update model (no optimistic final state).
- In-place message mutation only (no reordering).
- Add endpoint rate limit `20/minute`.

**Out:**
- Time-limited edit windows.
- Edit history/versioning UX.
- Optimistic write reconciliation.
- New dependencies.

## Implementation Notes
1. **Data model and migration first**
- Add `edited_at` model/schema fields and migration with downgrade.

2. **Backend edit endpoint**
- Enforce owner-only authz.
- Enforce validation and no-op rejection (`409`).
- Block edits when `deleted_at` is set.

3. **WS contract and transport**
- Extend WS schemas/types for `message_edited` in existing envelope shape.
- Broadcast updated content + edited timestamp.

4. **Frontend editing UX**
- Show edit affordance only for own messages and only when not deleted.
- Inline edit mode with save/cancel keyboard handling.
- Display `(edited)` marker with separate hover semantics:
  - timestamp hover -> `created_at`
  - `(edited)` hover -> `edited_at`

## Decision Locks (backend-coupled)
- [x] Locked: Authorization is owner-only.
- [x] Locked: Edit window is unlimited.
- [x] Locked: No-op edits are rejected with `409 Conflict`.
- [x] Locked: Validation matches message-create (trimmed, 1..1000 chars).
- [x] Locked: Deleted messages cannot be edited.
- [x] Locked: Keyboard behavior is `Enter` save, `Shift+Enter` newline, `Escape` cancel.
- [x] Locked: Timestamp semantics preserve original `created_at` and show `(edited)` marker with separate hovers.
- [x] Locked: Conflict policy is server-authoritative last-write-wins in v1.
- [x] Locked: WS event uses existing `{ type, message }` envelope with `message = { id, room_id, content, edited_at }`.
- [x] Locked: In-place update only; message order remains stable.
- [x] Locked: Endpoint rate limit is `20/minute`.

## Acceptance Criteria
- [ ] Alembic migration adds/removes `edited_at` cleanly.
- [ ] `PATCH /api/messages/{message_id}` enforces owner-only authz.
- [ ] Endpoint rejects no-op edits after trimming with `409`.
- [ ] Endpoint rejects edits to deleted messages.
- [ ] Endpoint returns updated message payload with `edited_at`.
- [ ] WS `message_edited` event is emitted with required envelope/payload.
- [ ] Frontend inline edit UX works with keyboard requirements.
- [ ] Frontend renders `(edited)` marker and correct hover timestamp behavior.
- [ ] Frontend applies in-place edits from API/WS without row reorder.
- [ ] Backend and frontend tests cover authz, validation, no-op/deleted rejection, WS sync, and UI behavior.
- [ ] Required docs updated in same PR (`docs/ARCHITECTURE.md`, `backend/TESTPLAN.md`, plus patterns/checklist if needed).

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
- [ ] Tests added/updated for backend + frontend behavior.
- [ ] Docs updated for schema/API/WS contract changes.
