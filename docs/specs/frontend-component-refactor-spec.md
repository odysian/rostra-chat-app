# Technical Spec: Frontend Component Refactor for File-Size Bloat

**Date:** 2026-02-22  
**Owner:** Frontend  
**Execution mode:** `gated` (one Technical Spec + child Task issues)
**Status:** Active (issue scaffolding complete)

## Tracking
- Spec issue: `#14`
- Child Task issues:
  - [ ] Task 1 (`RoomList` decomposition): `#15`
  - [ ] Task 2 (`MessageList` decomposition): `#16`
  - [ ] Task 3 (`ChatLayout` orchestration cleanup): `#17`
  - [ ] Task 4 (`MessageArea` decomposition): `#18`
- Finalizing PR: `TBD`

## Summary
Refactor oversized frontend components to reduce maintenance risk while preserving existing chat behavior and UI. This work targets the current hotspots: `RoomList`, `MessageList`, `ChatLayout`, and `MessageArea`.

This is a structural refactor, not a feature change. API contracts, WebSocket contracts, and user-visible behavior remain unchanged.

## Value / User Impact
- Faster and safer feature work in chat UI by reducing component complexity.
- Lower regression risk in high-change files (messaging, room state, subscriptions).
- Better testability of stateful behavior (scroll, subscriptions, unread, modals).
- Improved onboarding and review quality due to smaller, focused modules.

## Predict Before Build (Checkpoint 1)
1. Split data/state orchestration from rendering in the four hotspot files.
2. Keep behavior stable by extracting logic into hooks first, then extracting JSX subcomponents.
3. Primary risk is subtle state/closure regressions in WebSocket and scroll logic.
4. Mitigation is incremental extraction with parity tests after each Task.

## Decision Checkpoint (Checkpoint 2)
### Options considered
1. Big-bang rewrite into new global state architecture (e.g., reducer/store across chat surface).
2. Incremental extraction into local hooks + presentational subcomponents.
3. Keep current structure and only add comments/tests.

### Selected approach
Option 2 is selected. It delivers most maintainability value with the lowest behavior risk and avoids introducing new architectural surface area during a refactor-only effort.

## In Scope
- Decompose oversized components:
  - `frontend/src/components/RoomList.tsx`
  - `frontend/src/components/MessageList.tsx`
  - `frontend/src/components/ChatLayout.tsx`
  - `frontend/src/components/MessageArea.tsx`
- Extract reusable hooks for stateful concerns (room data, message feed/scroll behavior, chat subscription/event handling).
- Extract presentational subcomponents for modals, headers, and list rows/dividers.
- Keep existing tests passing; add targeted regression coverage where extraction risk is highest.
- Keep existing visual design and interaction model unchanged.

## Out of Scope
- Backend/API/WebSocket schema changes.
- New product features.
- New dependencies.
- Large style redesign or theming changes.
- Full rewrite of auth pages (may be tracked separately if desired).

## Compatibility Requirements
- No changes to API request/response shapes.
- No changes to WebSocket message formats.
- No changes to route structure.
- No changes to keyboard shortcut semantics.
- No changes to unread count behavior, room join/leave/delete behavior, or message list pagination behavior.

## Expected Behavior
- End users should not experience workflow changes in:
  - room selection and unread updates
  - command palette open/close and room jumping
  - message history load, infinite scroll, jump-to-latest, and new-message divider
  - typing indicators and WS error banners
  - room leave/delete flows and related modals
- Internal behavior should improve by reducing per-file responsibility overlap and effect density.

## Backend Plan (If Applicable)
No backend changes.

## Frontend Plan
### Task 1: `RoomList` decomposition
- Extract room data loading + retry + unread sync into a dedicated hook.
- Extract command palette UI/logic into a dedicated component.
- Extract create/logout modal UI blocks into dedicated components.
- Keep `RoomList` as container composition + wiring.

### Task 2: `MessageList` decomposition
- Extract message feed lifecycle logic (initial load, pagination, incoming append, scroll adjustment) into a dedicated hook.
- Extract message row and divider rendering into focused presentational components.
- Keep time/date formatting helpers colocated with rendering components unless reused elsewhere.

### Task 3: `ChatLayout` orchestration cleanup
- Extract WebSocket event handling and subscription policy into a dedicated hook/module.
- Remove duplicated room cleanup code paths by centralizing reset behavior in one helper.
- Keep `ChatLayout` focused on panel composition and top-level state wiring.

### Task 4: `MessageArea` decomposition
- Extract header/menu actions into a dedicated header component.
- Extract destructive confirmation modal into dedicated component.
- Keep typing indicator and ephemeral WS error rows in `MessageArea` for this pass; defer extracting those rows to a follow-up if needed.

## Child Task Map (Gated Execution)
| Task | Scope | Primary Files | Verify Focus |
| --- | --- | --- | --- |
| Task 1 | `RoomList` extraction (data + modal + palette composition cleanup) | `frontend/src/components/RoomList.tsx`, new `room-list/*`, optional `hooks/*` | room switching, unread badges, command palette shortcuts |
| Task 2 | `MessageList` extraction (feed lifecycle + rendering split) | `frontend/src/components/MessageList.tsx`, new `message-list/*`, optional `hooks/*` | pagination smoothness, divider behavior, jump-to-latest, context mode |
| Task 3 | `ChatLayout` orchestration cleanup (subscriptions + reset flow) | `frontend/src/components/ChatLayout.tsx`, new `hooks/useChatSubscriptions.ts` | room join/leave/delete, unread sync, WS reconnect/error handling |
| Task 4 | `MessageArea` composition split (header/actions/modal extraction) | `frontend/src/components/MessageArea.tsx`, new `message-area/*` | header actions, mobile back behavior, destructive action confirmation |

## Dependencies and Order
1. Execute Task 1 first to establish component extraction pattern.
2. Execute Task 2 second because it has the highest regression risk and largest component.
3. Execute Task 3 after Task 2 to keep subscription wiring changes isolated from message list churn.
4. Execute Task 4 last for low-risk composition cleanup.

## Files Expected
Existing files to refactor:
- `frontend/src/components/RoomList.tsx`
- `frontend/src/components/MessageList.tsx`
- `frontend/src/components/ChatLayout.tsx`
- `frontend/src/components/MessageArea.tsx`

Expected new files (names may vary slightly during implementation):
- `frontend/src/hooks/useRoomsData.ts`
- `frontend/src/hooks/useMessageFeed.ts`
- `frontend/src/hooks/useChatSubscriptions.ts`
- `frontend/src/components/room-list/RoomListCommandPalette.tsx`
- `frontend/src/components/room-list/RoomListModals.tsx`
- `frontend/src/components/message-list/MessageRow.tsx`
- `frontend/src/components/message-list/MessageDividers.tsx`
- `frontend/src/components/message-area/MessageAreaHeader.tsx`
- `frontend/src/components/message-area/DeleteRoomModal.tsx`

Test updates likely in:
- `frontend/src/components/__tests__/RoomList.test.tsx`
- `frontend/src/components/__tests__/MessageList.test.tsx`
- `frontend/src/components/__tests__/MessageArea.test.tsx`

## Tests / Regression Notes
- Preserve and run existing component tests as baseline.
- Add targeted tests around:
  - command palette behavior and room selection handoff
  - incoming message append + no-drop behavior
  - pagination and scroll position preservation
  - room cleanup behavior after leave/delete
- Manual regression pass for mobile sidebar overlay behavior and right-panel toggles.

## Decision Locks
1. Refactor-only: no new feature behavior.
2. No API/WebSocket contract changes.
3. No new dependencies.
4. Incremental extraction by Task; no big-bang rewrite.
5. Maintain current visual design and interaction semantics.
6. Keep theme and density behavior exactly as-is.
7. Keep existing keyboard shortcut semantics (`Cmd/Ctrl+K`, `/`, `Escape`) unchanged.
8. Hotspot file size target is ~350 LOC with hard cap <= 450 LOC per primary file; exceptions require a follow-up Task.
9. Task 4 extracts header/menu/delete modal (including delete-error handling) and defers typing indicator row + ephemeral WS error row extraction.
10. Naming convention is `kebab-case` subcomponent directories, `PascalCase` component files, and hooks in `src/hooks` as `useXxx`.

## Acceptance Criteria
1. All targeted hotspot components are decomposed and each primary file meets the LOC lock (target ~350, hard cap <= 450 LOC).
2. `RoomList`, `MessageList`, `ChatLayout`, and `MessageArea` preserve existing user-visible behavior.
3. Existing frontend tests pass; new regression tests for high-risk extracted logic are added and passing.
4. Frontend verification commands pass (`tsc`, `eslint`, `build`).
5. No backend code changes and no dependency changes are introduced.
6. Child Task issues are created and executed one at a time under this Spec (`gated` flow).

## Definition of Ready / Definition of Done
### Definition of Ready (for each child Task)
- [ ] Task issue has clear summary, scope in/out, and acceptance criteria.
- [ ] Verification commands are listed in the issue body.
- [ ] Required decision locks are copied from this Spec where applicable.
- [ ] Target file list and regression risks are explicit.

### Definition of Done (for each child Task)
- [ ] PR merged with `Closes #<task-id>`.
- [ ] Frontend verification commands pass.
- [ ] Relevant tests updated/added and passing.
- [ ] Required docs updated when behavior/patterns changed.
- [ ] Follow-up issues created for deferred work.

## Verification Commands
Run from `frontend/`:

```bash
npx tsc --noEmit
npx eslint src/
npm run build
npm test
```

## Rollout / Backout
- Rollout: ship child Tasks incrementally; each Task must be behavior-preserving and mergeable independently.
- Backout: revert individual Task PR if regressions appear, without blocking remaining Tasks.
- Guardrail: avoid cross-Task mixed refactors in a single PR; keep rollback blast radius small.

## Risks and Mitigations
- Risk: scroll behavior regressions in message list.
  - Mitigation: extract scroll logic behind tests before UI decomposition.
- Risk: stale closure bugs in WebSocket handlers.
  - Mitigation: isolate handler registration and state refs in dedicated hook; add focused tests.
- Risk: mobile overlay regressions due to component extraction.
  - Mitigation: keep props and DOM structure stable during first extraction pass.

## Explain-Back Before Finalize (Checkpoint 3)
- System fit: keeps current container/component architecture while reducing per-file responsibility.
- Pattern choice: hooks for stateful orchestration, components for rendering; reuse this pattern for future complex chat surfaces.
- Security/performance baseline: unchanged auth/network contracts; preserve existing request throttling behavior and pagination/observer performance path.
- Tradeoff: more files and indirection, but materially lower review and regression risk in high-change areas.

## Manual Rep Requirement (Checkpoint 4)
Per child Task, implement at least one focused unit manually (for example, one hook test case or one state-transition helper) before broader AI-assisted edits.

## Post-Merge Learning Note (Checkpoint 5)
After merge, record:
- one reusable refactor pattern in `docs/PATTERNS.md`
- one improvement to apply in the next structural refactor

## Resolved Lock Decisions
- [x] LOC target per hotspot primary file: target ~350 LOC, hard cap <= 450 LOC (exceptions require follow-up Task).
- [x] Task 4 scope: extract header/menu/delete modal in this pass; defer typing indicator row + ephemeral WS error row extraction.
- [x] Naming convention: `kebab-case` directories with `PascalCase` component files; hooks in `src/hooks` as `useXxx`.
