## Goal
Decompose `MessageList` by separating feed lifecycle logic from rendering while preserving pagination, scroll stability, and divider behavior.

Parent Spec: #14

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
- [x] Locked in Spec: Hotspot LOC target is ~350 with hard cap <= 450 LOC for each primary file.

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

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Responsibility Map (`MessageList.tsx`)
- Feed lifecycle orchestration:
  - normal-mode initial history fetch with timeout and retry
  - context-mode payload hydration (target highlight + cursors)
  - older/newer pagination requests with stale-response protection
  - incoming live append logic for both normal and context modes
  - context live-buffer carryover when exiting context mode
- Scroll orchestration:
  - initial positioning and context-target centering
  - prepend anchor capture + scroll restoration
  - append-to-bottom behavior when near latest
  - jump-to-latest visibility rules and suppression during animated jumps
  - top/bottom IntersectionObserver wiring for pagination
- Presentation and formatting:
  - date divider + NEW MESSAGES divider resolution
  - grouped message rendering and avatar/hover timestamp variants
  - loading/error/empty markers and pagination indicators
  - jump button rendering and labels in normal vs context mode
- Utility logic embedded in component:
  - timestamp normalization/parsing
  - strict recency comparison across mixed timestamp formats
  - unread anchor selection from initial room-entry snapshot

### Refactor Goals for This Task
- Keep `MessageList` public props, behavior, and room/chat integration semantics unchanged.
- Move feed lifecycle + pagination + scroll-correction state orchestration into a dedicated hook.
- Move row/divider rendering into focused presentational components under a feature-scoped directory.
- Keep message formatting rules and context-mode behavior identical to current implementation.

### Planned File Changes
- `frontend/src/components/MessageList.tsx` (convert to composition container; keep external contract stable)
- `frontend/src/hooks/useMessageFeedLifecycle.ts` (new; fetch/pagination/live-append/scroll orchestration)
- `frontend/src/components/message-list/MessageFeedContent.tsx` (new; list markers + row composition)
- `frontend/src/components/message-list/MessageRow.tsx` (new; grouped/non-grouped row rendering)
- `frontend/src/components/message-list/messageListFormatting.ts` (new; timestamp/date/grouping helpers reused by container + feed rendering)
- `frontend/src/components/__tests__/MessageList.test.tsx` (update/add targeted regression tests)

### Hook Contract Draft (`useMessageFeedLifecycle`)
- Inputs:
  - `roomId`
  - `token`
  - `userId`
  - `density`
  - `messageViewMode`
  - `messageContext`
  - `lastReadAtSnapshot`
  - `incomingMessages`
  - `scrollToLatestSignal`
  - `onIncomingMessagesProcessed`
  - `onExitContextMode`
- State returned:
  - `messages`, `loading`, `error`
  - `nextCursor`, `newerCursor`
  - `isLoadingMore`, `isLoadingNewer`
  - `showJumpToLatest`
  - `showContextLiveIndicator`
  - `highlightedMessageId`
  - `newMessagesAnchorId`
  - `isInitialPositioned`
- Refs returned:
  - `scrollContainerRef`, `sentinelRef`, `bottomSentinelRef`, `messagesEndRef`
- Actions returned:
  - `retryInitialLoad`
  - `jumpToLatest`
- Non-functional requirements:
  - preserve timeout message text, stale-epoch guards, divider anchor stability, and no-drop incoming append behavior.

### Component Contract Drafts
- `MessageFeedContent`:
  - receives list state (`messages`, `newMessagesAnchorId`, `highlightedMessageId`, `density`, `theme`)
  - receives formatting helpers and renders date/new-message dividers + row list
  - remains render-only (no async side effects)
- `MessageRow`:
  - receives one message item + grouping/highlight metadata
  - preserves avatar vs hover-time behavior and all existing typography/styling decisions
  - keeps `data-chat-message` and `data-message-id` attributes unchanged for scroll logic/tests

### Execution Steps (with verification checkpoints)
1. Extract pure formatting/grouping helpers into `messageListFormatting.ts` and wire existing component to them.
   - Verify: targeted `MessageList` tests for date/group/divider behavior still pass.
2. Extract lifecycle/pagination/scroll orchestration into `useMessageFeedLifecycle` while keeping current JSX in place.
   - Verify: targeted tests for append, context transitions, stale responses, and jump behavior pass.
3. Extract render tree into `MessageFeedContent` + `MessageRow` and keep `MessageList` as container.
   - Verify: tests for divider placement, highlight rendering, and jump CTA behavior pass.
4. Remove orphan logic/imports, run full frontend verification, then run full frontend test suite.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm run build`, `npm test -- MessageList.test.tsx`, `npm test`.

### Regression Guardrails (must stay true)
- Normal-mode initial load remains newest API page reversed to chronological UI order.
- Context-mode target centering/highlight behavior remains unchanged.
- Older-page prepend keeps viewport anchor stable with variable row heights.
- Incoming WS messages are not dropped under rapid bursts in either view mode.
- NEW MESSAGES divider anchor is resolved once per room-entry snapshot and does not shift mid-session.
- Jump-to-latest visibility thresholds/suppression behavior remain unchanged.
- `data-chat-message` and `data-message-id` attributes remain present for scroll and test selectors.

### Cross-Task Compatibility Checklist (`#16` -> `#17/#18`)
- [ ] `MessageListProps` public contract is unchanged (no prop rename/removal/semantic shift).
- [ ] `onIncomingMessagesProcessed` invocation semantics remain unchanged (called once per processed incoming batch).
- [ ] `scrollToLatestSignal` edge-trigger semantics remain unchanged.
- [ ] `onExitContextMode` ownership remains unchanged (triggered only through context jump flows/signals as before).
- [ ] Context-to-normal transition keeps buffered live messages with strict recency filtering.
- [ ] Normal vs context cursor semantics (`nextCursor`/`newerCursor`) remain unchanged.
- [ ] No `MessageArea` or `ChatLayout` orchestration contract changes are introduced.
- [ ] No API service signatures (`getRoomMessages`, `getRoomMessagesNewer`) are changed.

### Test Additions Planned
- Add regression test that a batched incoming set in context mode preserves dedupe + processed callback behavior.
- Add regression test that extracted row component preserves `data-message-id` attributes for anchor restoration.
- Add regression test that jump-to-latest action label switches correctly between hidden backlog and context live-indicator cases.
- Keep existing stale-response and context-exit carryover tests intact while adjusting for extracted component boundaries.
