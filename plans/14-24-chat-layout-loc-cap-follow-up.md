## Goal
Bring `ChatLayout` under the parent Spec LOC hard cap by extracting UI-effects and keyboard-shortcut orchestration into focused hooks, while preserving behavior and contracts.

Parent Spec: #14

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `status:ready`

## Scope
**In:**
- Refactor `frontend/src/components/ChatLayout.tsx`.
- Extract global keyboard shortcut handling into a dedicated hook.
- Extract localStorage/document-title side effects into a dedicated hook.
- Keep `ChatLayout` as composition/wiring container and preserve existing callback contracts.

**Out:**
- API/WS contract changes.
- New user-visible features.
- New dependencies.
- Reworking subscription/event orchestration extracted in Task #17.

## Dependencies
- Execute after Task 4 merge; this follow-up closes the remaining parent LOC hard-cap gap for `ChatLayout`.

## Implementation Notes
1. Preserve existing shortcut semantics (`Cmd/Ctrl+K`, `/`, `Escape`) and typing-target guard behavior.
2. Preserve `ChatLayout` -> `Sidebar`/`MessageArea`/`UsersPanel`/`SearchPanel` prop contracts.
3. Add focused regressions for shortcut wiring and panel interaction behavior.

## Decision Locks
- [x] Locked: Refactor-only and behavior-preserving.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked: Preserve keyboard shortcuts and panel interaction semantics unchanged.
- [x] Locked: Reduce `ChatLayout.tsx` to <= 450 LOC to satisfy parent Spec lock.

## Acceptance Criteria
- [ ] `ChatLayout` is decomposed with dedicated shortcuts/effects hooks and remains behavior-equivalent.
- [ ] `frontend/src/components/ChatLayout.tsx` is <= 450 LOC.
- [ ] Existing keyboard shortcuts and panel toggling behavior remain unchanged.
- [ ] Existing tests pass and targeted `ChatLayout` regression coverage is added/updated.
- [ ] Frontend verification commands pass.
- [ ] Docs updates are made if new reusable refactor patterns are introduced.

## Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test -- ChatLayout.test.tsx
cd frontend && npm test
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [ ] Docs updated if needed (`docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`, `backend/TESTPLAN.md`, `docs/adr/`).
- [ ] Tests added/updated where needed.

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Responsibility Map (`ChatLayout.tsx`)
- State orchestration:
  - selected room, room subscriptions, unread map, read markers
  - panel visibility, layout density, command palette/search focus signals
  - leave-error and WS-error handoff state
  - context-mode payload and incoming-room message queue
- Side effects:
  - localStorage density persistence
  - document title updates by selected room
  - global keyboard shortcuts and command/search panel triggers
  - typing timeout cleanup on unmount
- Action handlers and room lifecycle:
  - select, leave, delete, logout, and initial room auto-subscribe flows
  - room-scoped cleanup/reset orchestration
- Render composition:
  - Sidebar / MessageArea / UsersPanel / SearchPanel wiring and callback contracts

### Refactor Goals for This Task
- Keep all external behavior and child component contracts unchanged.
- Extract keyboard shortcut orchestration from `ChatLayout` body into a dedicated hook.
- Extract pure UI side effects (title + density persistence) into a dedicated hook.
- Reduce `ChatLayout.tsx` below the hard cap with minimal, surgical movement.

### Planned File Changes
- `frontend/src/components/ChatLayout.tsx` (reduce to orchestration + composition container)
- `frontend/src/hooks/useChatLayoutShortcuts.ts` (new; global shortcut handling and signal callbacks)
- `frontend/src/hooks/useChatLayoutUiEffects.ts` (new; density persistence + document title behavior)
- `frontend/src/components/__tests__/ChatLayout.test.tsx` (update/add targeted shortcut/panel regressions)

### Hook Contract Drafts
- `useChatLayoutShortcuts`
  - Inputs:
    - `selectedRoom`
    - callbacks: `onOpenCommandPalette`, `onCloseCommandPalette`, `onOpenSearchPanel`, `onCloseRightPanel`
  - Behavior preserved:
    - `Cmd/Ctrl+K` opens command palette signal
    - `/` opens search panel only when a room is selected and user is not typing in an editable target
    - `Escape` closes right panel + closes command palette signal
- `useChatLayoutUiEffects`
  - Inputs:
    - `selectedRoom`
    - `density`
  - Behavior preserved:
    - writes `rostra-density` to localStorage on density changes
    - document title resets to `Rostra` when no room is selected, otherwise `#<room> - Rostra`

### Execution Steps (with verification checkpoints)
1. Extract UI side effects (`density` persistence + document title) into `useChatLayoutUiEffects`.
   - Verify: existing `ChatLayout` tests still pass.
2. Extract shortcut handling into `useChatLayoutShortcuts` with callback wiring from container.
   - Verify: targeted tests for `Cmd/Ctrl+K`, `/`, `Escape`, and typing-target guard.
3. Remove orphaned effect logic from `ChatLayout`, confirm LOC <= 450, and run full verification.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm run build`, `npm test -- ChatLayout.test.tsx`, `npm test`.

### Regression Guardrails (must stay true)
- `ChatLayout` child prop contracts remain unchanged.
- Room selection still clears unread for selected room and preserves existing mark-read behavior.
- Leave/delete flows still clear selection, unsubscribe room, cleanup room-scoped state, and refresh room list.
- Shortcut semantics remain unchanged (`Cmd/Ctrl+K`, `/`, `Escape`).
- Search/users panel mutual exclusivity remains unchanged.
- Context-mode open/exit and incoming message queue behavior remain unchanged.

### Cross-Task Compatibility Checklist (`#18` -> `#19`)
- [ ] `MessageArea` public contract remains unchanged after Task #18 extraction.
- [ ] `Sidebar` command palette signal semantics remain edge-triggered counter increments.
- [ ] Existing Task #17 subscription/event hook extraction remains untouched in behavior.
- [ ] `SearchPanel` focus signal semantics remain unchanged.
- [ ] No API service signatures or WS payload assumptions are changed.
- [ ] No docs/runtime dependency changes are introduced.

### Test Additions Planned
- Add regression test for `Cmd/Ctrl+K` shortcut opening command palette signal.
- Add regression test for `/` shortcut opening search panel only when a room is selected.
- Add regression test for typing-target guard (`/` inside textarea/input does not open search panel).
- Keep existing leave/delete orchestration and WS-error handoff tests intact.
