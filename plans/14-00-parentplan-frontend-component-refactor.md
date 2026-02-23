## Summary
Refactor oversized frontend chat components to reduce maintenance risk while preserving current behavior and UI.

Source spec: `docs/specs/frontend-component-refactor-spec.md`

Suggested labels: `type:spec`, `area:frontend`, `area:tests`, `area:docs`, `status:ready`

## Value / User Impact
- Faster and safer chat-surface changes due to smaller, focused modules.
- Lower regression risk in high-churn UI paths (rooms, message feed, subscriptions).
- Better testability for stateful behavior (scroll, unread, modal and subscription flows).

## Scope
**In scope:**
- Decompose `RoomList`, `MessageList`, `ChatLayout`, and `MessageArea`.
- Extract stateful logic into focused hooks.
- Extract presentational subcomponents where it reduces file bloat.
- Keep behavior, contracts, and UX stable.

**Out of scope:**
- Backend/API/WebSocket schema changes.
- New product features.
- New dependencies.
- Visual redesign or route changes.

## How It Works (Expected Behavior)
1. Task 1 establishes extraction pattern in `RoomList`.
2. Task 2 handles highest-risk feed/scroll extraction in `MessageList`.
3. Task 3 isolates `ChatLayout` subscription orchestration and reset flow.
4. Task 4 finalizes `MessageArea` composition split.
5. Task 5 resolves the remaining `ChatLayout` LOC-cap exception via UI-effects/shortcut extraction.
6. Task 6 adds high-signal frontend comments/documentation to improve scanability without behavior changes.

## Backend Plan (If Applicable)
- API changes: None.
- Schema changes: None.
- WS events: None.
- Guardrails: No contract changes across REST/WS/auth semantics.

## Frontend Plan
- Task 1: `RoomList` data and modal/palette decomposition.
- Task 2: `MessageList` lifecycle and rendering decomposition.
- Task 3: `ChatLayout` subscription orchestration cleanup.
- Task 4: `MessageArea` header/action/modal decomposition.
- Task 5: `ChatLayout` LOC-cap follow-up decomposition (UI-effects + shortcut extraction).
- Task 6: frontend commenting/documentation pass across orchestration/lifecycle/services.

## Child Task Plan
- [x] Task 1 (`#15`): `plans/14-15-room-list-decomposition.md`
- [x] Task 2 (`#16`): `plans/14-16-message-list-decomposition.md`
- [x] Task 3 (`#17`): `plans/14-17-chat-layout-orchestration-cleanup.md`
- [x] Task 4 (`#18`): `plans/14-18-message-area-decomposition.md`
- [x] Task 5 (`#24`): `plans/14-24-chat-layout-loc-cap-follow-up.md`
- [ ] Task 6 (`#26`): `plans/14-26-frontend-commenting-documentation-pass.md`

## Decision Locks
- [x] Locked: Refactor-only; no new feature behavior.
- [x] Locked: No API/WebSocket contract changes.
- [x] Locked: No new dependencies.
- [x] Locked: Incremental extraction by task (no big-bang rewrite).
- [x] Locked: Keep visual design and interaction semantics unchanged.
- [x] Locked: Preserve keyboard shortcuts (`Cmd/Ctrl+K`, `/`, `Escape`).
- [x] Locked: Hotspot file size target is ~350 LOC, with hard cap <= 450 LOC per primary file; exceptions require a follow-up Task.
- [x] Locked: Task 4 extracts header/menu/delete modal (including `deleteError`) and defers typing indicator row + ephemeral `wsError` row extraction.
- [x] Locked: Naming convention is `kebab-case` subcomponent directories, `PascalCase` component files, and hooks in `src/hooks` as `useXxx`.
- [x] Locked: Task 6 is a comment/documentation-only pass and may exceed the LOC cap where needed for clarity.

## Acceptance Criteria
- [x] Spec issue created and linked from child Task issues.
- [x] Child Tasks are created and sequenced with explicit dependencies.
- [x] All four hotspot components are decomposed and each primary file met the LOC lock in the decomposition phase.
- [x] Existing behavior for room selection, unread updates, scroll/pagination, and modal actions is preserved.
- [x] Frontend verification commands pass for each merged decomposition Task.
- [ ] Required docs/tests are updated in each Task PR (including pending Task 6).

## Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test
```

## Notes
- This issue controls decision locks and cross-task sequencing for gated execution.
- Child Task PRs should close only Task issues (`Closes #<task-id>`), not this Spec issue.
