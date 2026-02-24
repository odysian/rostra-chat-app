## Goal
Implement Phase 3.4 **Message Deletion** end-to-end in `single` mode (one Task -> one PR), with soft delete semantics and real-time sync.

Suggested labels: `type:task`, `area:backend`, `area:frontend`, `area:ws`, `area:db`, `area:tests`, `area:docs`, `phase:3`, `status:ready`

## Scope
**In:**
- Add nullable `deleted_at` to `messages` via Alembic migration.
- Add `DELETE /api/messages/{message_id}` endpoint.
- Enforce authz matrix: message owner OR room creator.
- Enforce authz-first check order before idempotency behavior.
- Implement soft delete only:
  - set `deleted_at`,
  - scrub `content` to empty string.
- Keep deleted row in timeline (no removal/reorder).
- Keep endpoint idempotent for authorized callers (`204` on already-deleted row).
- Exclude deleted messages from `/api/rooms/{room_id}/messages/search` results.
- Add WS event `message_deleted` using existing `{ type, message }` envelope:
  - `type = "message_deleted"`
  - `message = { id, room_id, deleted_at }`
- Frontend in-place mutation on `message_deleted`.
- Frontend tombstone rendering: `(deleted)` in smaller muted/grey style.
- Disable edit/reaction actions on deleted messages.
- Add endpoint rate limit `20/minute`.

**Out:**
- Hard-delete behavior.
- Timeline row removal.
- Reactions feature implementation itself (only enforce deleted-message restrictions).
- New dependencies.

## Implementation Notes
1. **Data model and migration first**
- Add `deleted_at` to model/schema and migration with clean downgrade.

2. **Backend endpoint and query paths**
- Implement delete endpoint with strict room/membership-aware authorization.
- Ensure authz check executes before idempotency success path.
- Update search query path to exclude soft-deleted rows.

3. **WS contract and transport**
- Extend WS schemas/types for `message_deleted` using existing envelope shape.
- Broadcast from server on successful delete.

4. **Frontend behavior**
- Add authorized delete affordance + confirmation UX.
- Apply in-place row mutation from API/WS state.
- Render tombstone and preserve scroll/pagination ordering invariants.

## Decision Locks (backend-coupled)
- [x] Locked: Authorization is owner + room creator.
- [x] Locked: Authorization is checked before idempotency behavior (authz-first).
- [x] Locked: Deletion model is soft delete only (`deleted_at`), no hard delete in v1.
- [x] Locked: Content is scrubbed to empty string on delete.
- [x] Locked: Timeline row remains in place; no remove/reorder.
- [x] Locked: Deleted rows are excluded from search results.
- [x] Locked: Endpoint is idempotent for authorized callers and returns `204` for already-deleted rows.
- [x] Locked: WS event uses existing `{ type, message }` envelope with `message = { id, room_id, deleted_at }`.
- [x] Locked: Frontend updates deleted state in place and renders `(deleted)` in muted style.
- [x] Locked: Deleted messages are non-editable and non-reactable.
- [x] Locked: Endpoint rate limit is `20/minute`.

## Acceptance Criteria
- [ ] Alembic migration adds/removes `deleted_at` cleanly.
- [ ] `DELETE /api/messages/{message_id}` enforces owner+creator authz and authz-first order.
- [ ] Endpoint performs soft delete + content scrub and returns `204`.
- [ ] Endpoint is idempotent for authorized callers on already-deleted rows.
- [ ] Search endpoint excludes deleted rows.
- [ ] WS `message_deleted` event is emitted with required envelope/payload.
- [ ] Frontend renders tombstone `(deleted)` in-place without row movement.
- [ ] Frontend ignores edit/reaction actions for deleted rows.
- [ ] Backend and frontend tests cover authz, idempotency, search exclusion, WS sync, and timeline stability.
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
