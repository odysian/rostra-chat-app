## Goal
Ship a frontend-only UI/UX sweep for message row actions so `react/edit/delete` are usable on mobile and denser on desktop.

Suggested labels: `type:task`, `area:frontend`, `area:tests`, `area:docs`, `phase:3`, `status:ready`

## Scope
**In:**
- Replace desktop text actions (`REACT/EDIT/DELETE`) with a single hover/focus `...` trigger + action shelf.
- Keep desktop reveal behavior on hover/focus (`group-hover` + `focus-within`).
- Remove fixed action-width reservation from message row layout.
- Add mobile long-press (`350ms`) to open message action bottom sheet.
- Remove persistent mobile fallback trigger so coarse-pointer mode uses long-press only.
- Keep existing reaction/edit/delete handler contracts and permissions.
- Update frontend tests for new affordances and interaction paths.

**Out:**
- Backend/API/WS schema or payload changes.
- New dependencies.
- Changes to edit/delete/reaction business rules.

## Decision Locks
- [x] Locked: execution mode is `single` (one Task -> one PR).
- [x] Locked: mobile action surface is a **bottom sheet**.
- [x] Locked: long-press threshold is **350ms**.
- [x] Locked: desktop action affordance remains hover/focus reveal.
- [x] Locked: desktop uses one hover/focus `...` trigger that opens an anchored action shelf.
- [x] Locked: mobile has no persistent fallback `...` trigger (long-press only).
- [x] Locked: deleted messages remain non-reactable/non-editable and show no action affordances.

## Acceptance Criteria
- [ ] Desktop message rows no longer reserve fixed horizontal space for hidden actions.
- [ ] Desktop shows one hover/focus `...` trigger that opens anchored shelf actions.
- [ ] Desktop buttons remain keyboard reachable and screen-reader labeled.
- [ ] Mobile long-press on eligible message opens bottom sheet actions.
- [ ] Mobile coarse-pointer mode relies on long-press only (no visible `...` fallback).
- [ ] Bottom sheet presents quick reactions + allowed message actions + cancel.
- [ ] Existing delete confirmation modal still gates destructive delete action.
- [ ] Deleted messages do not expose action entry points.
- [ ] Frontend tests are updated for desktop and mobile interaction paths.
- [ ] Required frontend verification commands pass.

## Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test -- MessageList.test.tsx
```

## PR Checklist
- [ ] PR references this issue (`Closes #...`).
- [ ] Frontend tests added/updated for new interaction model.
- [ ] Docs updated if reusable UI pattern guidance changed (`docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`).
