## Goal
Clean up `ChatLayout` orchestration by isolating subscription/event handling and centralizing room reset behavior without changing runtime behavior.

Parent Spec: #14

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `status:blocked`

## Scope
**In:**
- Refactor `frontend/src/components/ChatLayout.tsx`.
- Extract subscription/event handling policy into a dedicated hook/module.
- Centralize duplicated room cleanup/reset paths into one helper.
- Keep `ChatLayout` focused on top-level state wiring and panel composition.

**Out:**
- Any backend or websocket message-format changes.
- New feature behavior.
- New dependencies.

## Dependencies
- Execute after Task 2 to avoid concurrent edits in message/subscription integration areas.

## Implementation Notes
1. Consolidate leave/delete reset paths before splitting files.
2. Keep WS handler registration semantics stable to avoid stale closure regressions.
3. Add focused tests for room join/leave/delete orchestration and WS error handling.

## Decision Locks
- [x] Locked: Refactor-only and behavior-preserving.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked: Keep existing keyboard and panel interaction semantics unchanged.

## Acceptance Criteria
- [ ] Subscription policy and event handling logic are extracted from `ChatLayout`.
- [ ] Room reset/cleanup behavior is centralized and unchanged for leave/delete flows.
- [ ] Existing tests pass and targeted orchestration regression coverage is added/updated.
- [ ] Frontend verification commands pass.
- [ ] Docs updates are made if new reusable orchestration patterns are introduced.

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
