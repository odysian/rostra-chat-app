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

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Responsibility Map (`ChatLayout.tsx`)
- State orchestration:
  - selected room, panel visibility, density, unread counts, read markers, typing users
  - message view mode + context payload ownership
  - incoming room message queue and processed callback handshake
- Keyboard + page-level UX:
  - global shortcuts (`Cmd/Ctrl+K`, `/`, `Escape`)
  - search focus signal + command palette open/close signals
  - document title updates from selected room
- WebSocket event policy:
  - handler registration lifecycle
  - per-event branching for `new_message`, `subscribed`, `user_joined`, `user_left`, `typing_indicator`, `error`
  - optimistic unread/read-marker updates and typing timeout bookkeeping
- Subscription policy:
  - room LRU list management with `MAX_SUBSCRIPTIONS` cap
  - initial auto-subscribe on first room list load
  - reconnect re-subscribe semantics + post-reconnect refresh trigger
- Room cleanup/reset paths:
  - duplicated leave/delete/no-token resets
  - subscription + room-scoped state pruning (online users, unread, read markers, incoming queue)
  - post-leave/post-delete room-list refresh trigger
- Render composition:
  - Sidebar / MessageArea / UsersPanel / SearchPanel wiring and callback contracts

### Refactor Goals for This Task
- Keep `ChatLayout` external behavior and child prop contracts unchanged.
- Extract subscription/reconnect policy from component body into a focused hook.
- Extract WS message-event handling orchestration into a focused hook/module while preserving stale-closure safety.
- Centralize room cleanup/reset behavior for leave/delete paths in one helper to remove duplicated state teardown logic.

### Planned File Changes
- `frontend/src/components/ChatLayout.tsx` (reduce to state + composition container, keep public behavior stable)
- `frontend/src/hooks/useChatLayoutSubscriptions.ts` (new; reconnect + subscribe/unsubscribe send policy)
- `frontend/src/hooks/useChatLayoutMessageHandler.ts` (new; WS event handler registration and event-specific state transitions)
- `frontend/src/components/chat-layout/chatLayoutRoomState.ts` (new; centralized room reset/cleanup helpers)
- `frontend/src/components/__tests__/ChatLayout.test.tsx` (new; targeted orchestration regressions)

### Hook/Helper Contract Drafts
- `useChatLayoutSubscriptions`
  - Inputs:
    - `connected`
    - `subscribedRoomIds`
    - `subscribe`
    - `setRefreshTrigger`
    - `subscribedSentRef`
    - `prevConnectedRef`
    - `hasConnectedOnceRef`
  - Behavior:
    - clears sent-cache when WS reconnects
    - schedules unread refresh trigger after reconnect (not initial connect)
    - sends subscribe only for unsent room IDs
    - prunes sent-cache entries for removed room IDs
- `useChatLayoutMessageHandler`
  - Inputs:
    - `registerMessageHandler`
    - refs: `selectedRoomRef`, `subscribedRoomIdsRef`, `tokenRef`, `typingTimeoutsRef`
    - setters/actions for unread/read-marker/online users/incoming queue/ws error
  - Outputs:
    - none (side-effect hook)
  - Non-functional requirements:
    - preserve `registerMessageHandler` cleanup semantics (`undefined` on unmount)
    - preserve 4s WS error auto-clear behavior
    - preserve no-drop incoming append and typing-indicator timeout handling
- `chatLayoutRoomState` helper(s)
  - `clearSelectedRoomState(setters, roomId?)`
    - centralizes normal/context reset + incoming queue clear
    - optionally prunes room-scoped maps for a specific room id
  - used by leave/delete/no-token paths to eliminate duplicated reset logic

### Execution Steps (with verification checkpoints)
1. Extract room cleanup/reset helpers and wire leave/delete/no-token branches to one shared path.
   - Verify: targeted `ChatLayout` tests for leave/delete/reset semantics.
2. Extract subscription/reconnect effects into `useChatLayoutSubscriptions`.
   - Verify: tests for initial subscribe and reconnect refresh/subscribe behavior.
3. Extract WS event handler registration into `useChatLayoutMessageHandler`.
   - Verify: tests for WS error banner flow + unread updates for selected/non-selected rooms.
4. Add/finish targeted regression tests and clean container imports/orphan logic.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm run build`, `npm test -- ChatLayout.test.tsx`, `npm test`.

### Regression Guardrails (must stay true)
- Shortcut semantics remain unchanged (`Cmd/Ctrl+K`, `/`, `Escape`).
- Leave/delete flows still clear selection, unsubscribe room, and refresh room list.
- Room selection still resets context mode and takes freshest read-marker snapshot behavior.
- Selected-room incoming messages append to feed queue and trigger mark-read side effect.
- Non-selected subscribed-room messages only increment unread counts.
- Typing indicator state still auto-clears after 3 seconds and clears on sender message.
- Reconnect still re-subscribes tracked rooms without duplicate subscribe sends.

### Cross-Task Compatibility Checklist (`#17` -> `#18`)
- [ ] `Sidebar` prop contract remains unchanged (including command palette signal counters).
- [ ] `MessageArea` prop contract remains unchanged (including `incomingMessages` + processed callback).
- [ ] `SearchPanel` open/focus/message-context integration semantics remain unchanged.
- [ ] `roomOpenLastReadSnapshot` derivation timing remains unchanged for new-message divider stability.
- [ ] `onInitialRoomsLoaded` one-time auto-subscribe ownership remains in `ChatLayout`.
- [ ] Subscription cap semantics (`MAX_SUBSCRIPTIONS` LRU eviction behavior) remain unchanged.
- [ ] No WebSocket payload shape assumptions or API service signatures are changed.
- [ ] No `MessageList` or `MessageArea` internal behavior is altered beyond existing callbacks.

### Test Additions Planned
- Add regression test that leave-room flow unsubscribes selected room, clears selection, and bumps refresh trigger even when API leave fails.
- Add regression test that room-delete callback uses centralized cleanup (unsubscribes + prunes room-scoped state + refresh trigger).
- Add regression test that WS `error` messages render/dismiss via `MessageArea` banner wiring.
- Add regression test that WS `new_message` increments unread for non-selected subscribed rooms while selected-room messages go to incoming queue.
