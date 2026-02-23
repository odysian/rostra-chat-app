## Goal
Improve frontend code readability by adding high-signal comments and lightweight module-level documentation to complex files, so contributors can scan and understand behavior quickly without changing runtime behavior.

Parent Spec: #14

Suggested labels: `type:task`, `area:frontend`, `area:docs`, `status:ready`

## Scope
**In:**
- Add targeted, production-quality comments across frontend hotspots (components/hooks/context/services) where behavior is non-obvious.
- Clarify data flow, ownership, invariants, and side-effect intent in complex orchestration files.
- Add or update documentation guidance if a reusable comment convention is established.

**Out:**
- Feature behavior changes.
- API/WS contract changes.
- Styling/UX changes.
- Dependency changes.
- Mechanical commenting of obvious lines.

## Dependencies
- Execute after Task 5 (`#24`) is merged under Parent Spec `#14`, so comments describe the current post-refactor architecture.

## Implementation Notes
1. Comment intent over mechanics: explain *why* and invariants, not obvious syntax.
2. Prioritize high-complexity areas first (layout orchestration, feed lifecycle, WS flow, API client behavior).
3. Keep comments concise; avoid redundant/low-signal noise.
4. It is acceptable for comment additions to push a file above 450 LOC in this task.
5. If the docs-only diff becomes too large to review comfortably, split into two follow-up docs-only Tasks by subsystem (for example: chat orchestration/feed vs services/context).

## Decision Locks
- [x] Locked: Documentation-only pass (comments/doc clarity), no behavior changes.
- [x] Locked: No API/WS contract changes.
- [x] Locked: No new dependencies.
- [x] Locked: Comment additions may exceed prior LOC cap when they improve maintainability.
- [x] Locked: Favor “why/invariant” comments and module responsibility headers in complex files.

## Acceptance Criteria
- [ ] High-signal comments are added to targeted frontend hotspot files and improve scanability.
- [ ] Added comments document key state ownership, side-effect intent, event/data flow, and non-obvious guardrails.
- [ ] Comments explicitly explain invariants, tradeoffs, and ownership boundaries (not line-by-line mechanics).
- [ ] No user-visible behavior or contracts change.
- [ ] Frontend verification commands pass.
- [ ] `docs/PATTERNS.md` is updated if a reusable comment convention is introduced.

## Verification
```bash
# Canonical frontend verification
make frontend-verify

# Fallback if make target is unavailable in the environment
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [ ] Docs updated if needed (`docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`).
- [ ] No behavior drift introduced; comments only.

## Detailed Refactor Whiteboard (Pre-Implementation)

### Current Documentation Gap Map (Frontend)
- Layout orchestration and state ownership:
  - `frontend/src/components/ChatLayout.tsx`
  - `frontend/src/hooks/useChatLayoutMessageHandler.ts`
  - `frontend/src/hooks/useChatLayoutSubscriptions.ts`
  - `frontend/src/hooks/useChatLayoutShortcuts.ts`
  - `frontend/src/hooks/useChatLayoutUiEffects.ts`
- Message feed lifecycle and scroll invariants:
  - `frontend/src/hooks/useMessageFeedLifecycle.ts`
  - `frontend/src/hooks/useMessageFeedViewport.ts`
  - `frontend/src/components/message-list/messageListFormatting.ts`
  - `frontend/src/components/message-list/MessageFeedContent.tsx`
- Context/service flow and failure semantics:
  - `frontend/src/context/WebSocketContext.tsx`
  - `frontend/src/services/websocket.ts`
  - `frontend/src/services/api.ts`

### Documentation Goals for This Task
- Make each complex file answer these quickly:
  - What responsibility this file owns.
  - Which state/callbacks are authoritative.
  - Which invariants must remain true.
  - Why specific guards/timeouts/orders exist.
- Keep comments precise enough that a new contributor can trace message and panel flows without debugging first.

### Planned File Changes
- `frontend/src/components/ChatLayout.tsx` (clarify orchestration ownership and room lifecycle intent)
- `frontend/src/hooks/useChatLayoutMessageHandler.ts` (WS event policy + side-effect rationale)
- `frontend/src/hooks/useChatLayoutSubscriptions.ts` (reconnect/subscribe policy intent)
- `frontend/src/hooks/useChatLayoutShortcuts.ts` (shortcut guard/ownership intent)
- `frontend/src/hooks/useChatLayoutUiEffects.ts` (UI side-effect ownership intent)
- `frontend/src/hooks/useMessageFeedLifecycle.ts` (pagination/context/divider invariants)
- `frontend/src/hooks/useMessageFeedViewport.ts` (scroll anchoring invariants)
- `frontend/src/components/message-list/messageListFormatting.ts` (ordering/divider helper intent)
- `frontend/src/services/api.ts` (retry/timeout/401 behavior rationale)
- `frontend/src/services/websocket.ts` + `frontend/src/context/WebSocketContext.tsx` (reconnect and dispatch semantics)
- `docs/PATTERNS.md` (only if comment convention is reusable across frontend)

### Comment Contract Draft (What “Good” Looks Like)
- Module responsibility header:
  - 2-5 lines summarizing purpose, ownership boundaries, and major side effects.
- State ownership notes:
  - identify source-of-truth state and why derived state exists.
- Effect rationale notes:
  - explain non-obvious dependency choices, cleanup, and sequencing constraints.
- Invariant/guardrail notes:
  - explain rules like “do not drop incoming messages,” “preserve anchor on prepend,” “avoid duplicate subscribe sends.”
- Avoid:
  - line-by-line narration of obvious JSX/TS syntax.
  - stale roadmap comments not tied to current behavior.

### Execution Steps (with verification checkpoints)
1. Annotate orchestration files (`ChatLayout` + chat-layout hooks) with ownership/invariant comments.
   - Verify: targeted `ChatLayout` tests still pass.
2. Annotate message feed lifecycle/viewport/formatting files with pagination and scroll rationale comments.
   - Verify: `MessageList` tests still pass.
3. Annotate service/context files with retry/reconnect/error semantics comments.
   - Verify: service/context tests still pass.
4. Run full frontend verification and update `PATTERNS` only if convention matured.
   - Verify: `npx tsc --noEmit`, `npx eslint src/`, `npm run build`, `npm test`.

### Regression Guardrails (must stay true)
- Comment-only intent: no runtime behavior, API calls, or event semantics changed.
- No prop contract changes between `ChatLayout`, `MessageArea`, `Sidebar`, and panels.
- No API client retry/auth semantics drift.
- No WS reconnect/subscription semantics drift.
- No pagination/scroll/divider behavior drift.

### Cross-Task Compatibility Checklist (`#24` -> `#26`)
- [ ] Task #24 shortcut/ui-effect extraction boundaries remain intact.
- [ ] Existing Task #15-#18 decomposition boundaries are not collapsed by comment edits.
- [ ] No test fixtures/mocks depend on removed or behavior-changing comments.
- [ ] Parent Spec #14 remains source of truth for flow/locks while this task only improves readability.

### Test Additions Planned
- No new behavior tests required by default (comment-only task).
- Run existing frontend suite as regression proof.
- Add tests only if edits accidentally uncover latent behavior ambiguity that needs codified guardrails.
