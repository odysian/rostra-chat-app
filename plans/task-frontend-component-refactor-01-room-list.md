## Goal
Decompose `RoomList` into smaller state + UI units while preserving current room-list behavior and keyboard UX.

Parent PRD: #14

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `status:ready`

## Scope
**In:**
- Refactor `frontend/src/components/RoomList.tsx`.
- Extract room data loading/retry/unread sync into a dedicated hook.
- Extract command palette UI/logic into a focused component.
- Extract create/logout modal blocks into focused components.
- Keep `RoomList` as composition/wiring container.

**Out:**
- Contract changes (API/WS/routes).
- New dependencies.
- Behavior changes to keyboard shortcuts or unread semantics.

## Implementation Notes
1. Move stateful orchestration first, then move JSX blocks.
2. Keep prop/API surface of `RoomList` stable to avoid ChatLayout churn in this Task.
3. Add targeted tests for command palette and room-selection handoff behavior.

## Decision Locks
- [x] Locked: Refactor-only and behavior-preserving.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked: Preserve shortcuts (`Cmd/Ctrl+K`, `/`, `Escape`).
- [x] Locked in PRD: Use `kebab-case` directories, `PascalCase` component files, and `useXxx` hooks in `src/hooks`.

## Acceptance Criteria
- [ ] `RoomList` is decomposed into hook/subcomponents and remains behavior-equivalent.
- [ ] Room switching, unread badges, and command palette shortcuts behave exactly as before.
- [ ] Existing `RoomList` tests pass and targeted regression coverage is added/updated.
- [ ] Frontend verification commands pass.
- [ ] Docs updates are made if new reusable pattern guidance is introduced.

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
