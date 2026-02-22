## Goal
Decompose `MessageList` by separating feed lifecycle logic from rendering while preserving pagination, scroll stability, and divider behavior.

Parent PRD: #14

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `status:blocked`

## Scope
**In:**
- Refactor `frontend/src/components/MessageList.tsx`.
- Extract message lifecycle logic (initial load, older pagination, incoming append, scroll adjustment) into a dedicated hook.
- Extract message row/divider rendering into focused presentational components.
- Keep current formatting and context-mode behavior stable.

**Out:**
- Backend contract changes.
- New UX behavior.
- Dependency additions.

## Dependencies
- Depends on Task 1 completion to reuse extraction pattern and reduce concurrent churn.

## Implementation Notes
1. Extract scroll/key lifecycle first, then split rendering.
2. Preserve strict ordering semantics in normal and context modes.
3. Add focused regression tests for no-drop append, divider placement, and jump-to-latest behavior.

## Decision Locks
- [x] Locked: Refactor-only and behavior-preserving.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked in PRD: Hotspot LOC target is ~350 with hard cap <= 450 LOC for each primary file.

## Acceptance Criteria
- [ ] `MessageList` lifecycle logic is extracted and rendering is split into focused components.
- [ ] Pagination, scroll position preservation, divider behavior, and context-mode behavior are unchanged.
- [ ] Existing tests pass and targeted high-risk regression tests are added/updated.
- [ ] Frontend verification commands pass.
- [ ] Docs updates are made if new reusable refactor patterns are introduced.

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
