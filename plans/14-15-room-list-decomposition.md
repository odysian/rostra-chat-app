## Goal
Decompose `RoomList` into smaller state + UI units while preserving current room-list behavior and keyboard UX.

Parent Spec: #14

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
- [x] Locked in Spec: Use `kebab-case` directories, `PascalCase` component files, and `useXxx` hooks in `src/hooks`.

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

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Responsibility Map (`RoomList.tsx`)
- Data orchestration:
  - initial room fetch with timeout fallback
  - retry flow
  - refresh-trigger reload
  - unread-count extraction + callback propagation
  - initial rooms callback reporting (one-time)
- Room mutations:
  - create-room input validation and submit flow
  - post-create optimistic append + room selection
  - discovery modal join callback reloading rooms
- Overlay orchestration:
  - create modal
  - logout modal
  - command palette
  - discovery modal
  - focus trap and close semantics
- Rendering:
  - loading/error/empty/list states
  - expanded + collapsed room row variants
  - action buttons and user block
  - command palette UI and filtering logic
  - create/logout modal UI

### Refactor Goals for This Task
- Keep `RoomList` public props and behavior unchanged.
- Move fetch/reload/create orchestration into a hook.
- Move command palette rendering/filtering into a focused subcomponent.
- Move create/logout modal rendering into focused subcomponents.
- Keep discovery modal wiring in `RoomList` (single integration point).

### Planned File Changes
- `frontend/src/components/RoomList.tsx` (container/wiring only; reduced responsibilities)
- `frontend/src/hooks/useRoomsData.ts` (new; rooms fetch/retry/reload/create orchestration)
- `frontend/src/components/room-list/RoomListCommandPalette.tsx` (new)
- `frontend/src/components/room-list/CreateRoomModal.tsx` (new)
- `frontend/src/components/room-list/LogoutModal.tsx` (new)
- `frontend/src/components/__tests__/RoomList.test.tsx` (update/add targeted regressions)

### Hook Contract Draft (`useRoomsData`)
- Inputs:
  - `token`
  - `refreshTrigger`
  - `onUnreadCountsLoaded`
  - `onInitialRoomsLoaded`
  - `onSelectRoom`
- State returned:
  - `rooms`, `loading`, `error`
  - `creating`, `createError`
  - `newRoomName`
- Actions returned:
  - `setNewRoomName`
  - `retryLoadRooms`
  - `reloadRooms`
  - `createRoomFromInput` (validation + create + select)
  - `resetCreateState`
- Non-functional requirement:
  - preserve current timeout message and one-time initial rooms callback behavior.

### Command Palette Component Draft (`RoomListCommandPalette`)
- Inputs:
  - `isOpen`, `query`, `setQuery`, `onClose`
  - `rooms`, `onSelectRoom`
  - `theme`, `crtEnabled`
  - `onOpenCreateModal`, `onOpenDiscoveryModal`, `onToggleTheme`, `onToggleCrt`
- Behavior preserved:
  - Enter executes first visible match.
  - Filtering checks action labels/keywords + formatted room names.
  - Closing resets query.
  - Focuses input on open.

### Modal Component Drafts
- `CreateRoomModal`:
  - receives controlled values/actions from hook (`newRoomName`, `setNewRoomName`, `createError`, `creating`, `onSubmit`, `onClose`)
  - preserves validation/error text and disabled submit behavior.
- `LogoutModal`:
  - receives `onConfirmLogout`, `onClose`
  - preserves confirm-first flow (`close` then `onLogout`).

### Execution Steps (with verification checkpoints)
1. Extract `useRoomsData` and wire `RoomList` to it without JSX moves.
   - Verify: existing `RoomList` tests still pass.
2. Extract `RoomListCommandPalette` and wire signal open/close paths.
   - Verify: command palette open/close and first-match behaviors via tests.
3. Extract `CreateRoomModal` and `LogoutModal`.
   - Verify: create validation/create success/create error + logout escape/confirm tests.
4. Clean container composition and remove orphan logic/imports.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm test`, `npm run build`.

### Regression Guardrails (must stay true)
- Keyboard shortcuts/semantics remain unchanged (`Cmd/Ctrl+K`, `/`, `Escape`).
- Room selection and unread badge behavior remain unchanged.
- Tab from room row still focuses message input when applicable.
- Loading timeout and retry behavior remain unchanged.
- Discovery modal join callback still reloads rooms and unread counts.

### Cross-Task Compatibility Checklist (`#15` -> `#16/#17/#18`)
- [ ] `RoomListProps` public contract is unchanged (no prop rename/removal/semantic shift).
- [ ] Command palette signal semantics are unchanged (`openCommandPaletteSignal`/`closeCommandPaletteSignal` still edge-triggered by counter increment).
- [ ] `onUnreadCountsLoaded` payload/timing remains unchanged for initial load and reload paths.
- [ ] `onInitialRoomsLoaded` remains one-time only and only for first successful initial fetch.
- [ ] Discovery modal join flow still reloads rooms and unread counts through the same integration path.
- [ ] Room selection side effect after create remains unchanged (`create -> append -> select`).
- [ ] Keyboard ownership boundaries are unchanged (no shortcut ownership moved into/out of parent components).
- [ ] No `ChatLayout` orchestration logic is modified in this task.

### Test Additions Planned
- Command palette opens when `openCommandPaletteSignal` increments.
- Command palette closes when `closeCommandPaletteSignal` increments.
- Enter in palette selects first visible room when no actions match.
- Create-room action in palette opens create modal and closes palette.
