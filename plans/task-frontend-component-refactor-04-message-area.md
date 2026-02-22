## Goal
Decompose `MessageArea` into focused composition units (header/actions/modal) while preserving room-header behavior and destructive-action flows.

Parent Spec: #14

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `status:blocked`

## Scope
**In:**
- Refactor `frontend/src/components/MessageArea.tsx`.
- Extract header/menu actions into a dedicated header component.
- Extract destructive confirmation modal into a dedicated modal component.
- Keep typing indicator and ephemeral WS error rows inside `MessageArea` in this pass.

**Out:**
- API/WS contract changes.
- New user-visible features.
- Dependency changes.
- Extracting typing indicator row or ephemeral WS error row into separate components.

## Dependencies
- Execute after Task 3 to keep top-level orchestration stable before final composition extraction.

## Implementation Notes
1. Keep existing props contract between `ChatLayout` and `MessageArea`.
2. Maintain mobile back behavior and delete-room confirmation semantics.
3. Add/adjust tests for header actions and modal confirmation flows.

## Decision Locks
- [x] Locked: Refactor-only and behavior-preserving.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked in Spec: Extract header/menu/delete modal only (including `deleteError` handling); defer typing indicator + `wsError` rows.

## Acceptance Criteria
- [ ] `MessageArea` is decomposed with dedicated header/actions/modal components.
- [ ] Header actions, mobile back behavior, and destructive confirmations remain unchanged.
- [ ] Typing indicator row and ephemeral WS error row behavior remains unchanged in `MessageArea`.
- [ ] Existing tests pass and targeted regression coverage is added/updated.
- [ ] Frontend verification commands pass.
- [ ] Docs updates are made if new reusable component-split patterns are introduced.

## Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [ ] Docs updated if needed (`docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`, `backend/TESTPLAN.md`, `docs/adr/`).
- [ ] Tests added/updated where needed.
