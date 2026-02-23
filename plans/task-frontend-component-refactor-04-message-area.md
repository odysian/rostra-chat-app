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

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Responsibility Map (`MessageArea.tsx`)
- Empty-state rendering:
  - welcome panel when no room is selected
  - theme-specific heading rendering
- Header rendering + interaction orchestration:
  - mobile back button with unread-dot affordance
  - room title formatting/styling
  - room options trigger + dropdown visibility lifecycle
  - room menu actions (leave + owner-only delete entry)
  - search/users action buttons
- Destructive action orchestration:
  - delete modal open/close lifecycle
  - delete mutation state (`deleting`, `deleteError`)
  - success path (`onRoomDeleted`) and inline error path
  - focus trap + Escape/overlay close behavior
- Keyboard behavior:
  - Escape handling for room menu dismiss
  - custom tab-order routing for input/send/back/menu/search/users controls
- Message feed/input wiring:
  - `MessageList` contract passthrough
  - `scrollToLatestSignal` ownership for local sends
  - `MessageInput` contract passthrough
- Room-level status rows:
  - typing indicator row text formatting + fixed-height layout reservation
  - ephemeral WebSocket error row + dismiss action

### Refactor Goals for This Task
- Keep `MessageArea` public props and all parent-visible behavior unchanged.
- Extract header/menu actions into dedicated message-area components.
- Extract delete confirmation modal into a dedicated message-area component.
- Keep typing indicator row and WS error row logic inside `MessageArea` for this task.

### Planned File Changes
- `frontend/src/components/MessageArea.tsx` (reduce to container/composition + retained status-row behavior)
- `frontend/src/components/message-area/MessageAreaHeader.tsx` (new; room header + action controls + room options menu)
- `frontend/src/components/message-area/DeleteRoomModal.tsx` (new; destructive confirmation UI and inline error rendering)
- `frontend/src/components/__tests__/MessageArea.test.tsx` (update/add targeted header/mobile/delete-flow regressions)

### Hook/Component Contract Drafts
- `MessageAreaHeader`
  - Inputs:
    - `displayRoomName`
    - `theme`
    - `showRoomMenu`
    - `hasOtherUnreadRooms`
    - `isRoomOwner`
    - callbacks: `onBackToRooms`, `onToggleRoomMenu`, `onCloseRoomMenu`, `onLeaveRoom`, `onRequestDeleteRoom`, `onToggleSearch`, `onToggleUsers`
  - Behavior preserved:
    - mobile back button semantics and unread dot rendering
    - room options menu open/close and leave/delete actions
    - search/users callbacks unchanged
    - room title rendering parity for neon/amber themes
- `DeleteRoomModal`
  - Inputs:
    - `open`
    - `displayRoomName`
    - `deleting`
    - `deleteError`
    - `modalRef` (for existing focus trap hook integration)
    - callbacks: `onCancel`, `onConfirm`
  - Behavior preserved:
    - cancel disabled while deleting
    - destructive button text swap (`DELETE ROOM` / `DELETING...`)
    - inline error message rendering
    - dialog semantics (`role=dialog`, `aria-modal`, title linkage)

### Execution Steps (with verification checkpoints)
1. Add `MessageAreaHeader` and move header/menu JSX + callbacks without changing `MessageArea` public props.
   - Verify: targeted tests for room options actions and mobile back behavior.
2. Add `DeleteRoomModal` and move delete-modal JSX while retaining existing delete state/mutation flow in `MessageArea`.
   - Verify: targeted tests for successful delete, failure inline error, and cancel/close behavior.
3. Keep typing/ws-error rows in `MessageArea`, remove orphaned header/modal logic, and ensure no contract drift with `ChatLayout`.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm run build`, `npm test -- MessageArea.test.tsx`, `npm test`.

### Regression Guardrails (must stay true)
- `MessageAreaProps` external shape and semantics are unchanged.
- Mobile back button still calls `onBackToRooms` and keeps unread indicator behavior.
- Room menu still supports Escape close, overlay close, leave action, and owner-only delete action.
- Delete flow still calls `deleteRoom(roomId, token)` and only fires `onRoomDeleted` on success.
- Delete API failure still renders inline modal error (no alert/dialog fallback).
- `MessageList`/`MessageInput` wiring and `scrollToLatestSignal` behavior remain unchanged.
- Typing indicator row and WS error row remain in `MessageArea` with identical behavior.

### Cross-Task Compatibility Checklist (`#17` -> `#18`)
- [ ] `ChatLayout` -> `MessageArea` prop contract remains unchanged (no prop rename/removal/semantic shift).
- [ ] `onBackToRooms` flow still interoperates with `ChatLayout` mobile sidebar behavior.
- [ ] `onRoomDeleted` and `onLeaveRoom` callbacks still trigger existing room-reset orchestration in `ChatLayout`.
- [ ] `incomingMessages` + `onIncomingMessagesProcessed` contract remains unchanged for `MessageList`.
- [ ] Context-mode props (`messageViewMode`, `messageContext`, `onExitContextMode`) pass through unchanged.
- [ ] `wsError` + `onDismissWsError` wiring remains unchanged.
- [ ] No API service signature or WebSocket payload assumptions are changed.

### Test Additions Planned
- Add regression test that mobile back button calls `onBackToRooms`.
- Add regression test that header action buttons still call `onToggleSearch` and `onToggleUsers`.
- Add regression test that owner delete flow opens modal and confirm path calls API + `onRoomDeleted`.
- Add regression test that delete failure preserves modal visibility and inline error text.
- Keep/adjust existing tests that cover room menu Escape close, leave-room callback, typing indicator text, and WS error dismiss.
