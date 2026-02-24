## Goal
Improve message-row action usability for `react/edit/delete` across desktop and mobile without changing backend/API/WS contracts.

## Proposed Execution Mode
`single` (default): one Task issue -> one PR.

Why not `fast`: this touches interaction model, accessibility behavior, and tests across multiple frontend files.

## Problem Statement
- Current actions rely on hover visibility, which is poor on touch devices.
- Action cluster occupies fixed horizontal space even when hidden (`opacity` only), reducing message content room.
- Text buttons (`REACT/EDIT/DELETE`) are visually noisy and slower to scan than icon affordances.

## UX Objectives
- Remove fixed reserved action width from message rows.
- Keep desktop hover/focus discoverability.
- Add mobile-first long-press action entry.
- Preserve existing permissions and safety constraints (deleted rows non-reactable/non-editable).
- Keep retro theme language while improving clarity and hit targets.

## Proposed Interaction Model
### Desktop (`pointer: fine`, hover-capable)
- Show a single `...` trigger on `group-hover` and `focus-within`.
- Clicking `...` opens an anchored action shelf with quick reactions + edit/delete actions.
- Shelf text and labels use brighter readability tokens (not muted meta text).

### Mobile/Touch (`pointer: coarse`, no reliable hover)
- Long-press on message body opens a message action menu.
- Recommended surface: bottom sheet style menu (larger tap targets, thumb-friendly).
- Menu sections:
- Quick reactions row (locked allowlist)
- `Edit message` action (only when allowed)
- `Delete message` action (only when allowed)
- `Cancel`
- Short tap on message remains no-op (does not steal normal scroll behavior).

## Behavior Rules (Must Stay True)
- Deleted messages show no action entry points.
- Permissions stay unchanged:
- React: authenticated user on active (non-deleted) message.
- Edit: message owner only.
- Delete: message owner or room creator.
- Reaction API behavior remains server-authoritative and unchanged.
- Existing delete confirmation modal stays in place for destructive confirmation.

## Accessibility + Input Requirements
- Desktop `...` trigger and shelf actions must have explicit `aria-label`s.
- Desktop trigger/shelf must be keyboard reachable (`focus-within` visibility).
- Mobile action menu supports close by outside tap and `Escape`.
- Minimum action target size: 32px desktop, 40px mobile.
- Long-press should not trigger while user is selecting text inside editable controls.

## UI Structure Sketch (Frontend Only)
- Keep message content in full-width flow.
- Move row action controls out of flex width reservation into absolute overlay.
- Introduce one reusable action surface component used by both:
- Desktop `...` trigger -> anchored shelf.
- Mobile long-press menu presentation.

## Planned File Touches (Implementation Phase)
- `frontend/src/components/message-list/MessageRow.tsx`
- `frontend/src/components/message-list/MessageFeedContent.tsx` (if prop plumbing changes)
- `frontend/src/components/message-list/` (new action menu/sheet component)
- `frontend/src/components/__tests__/MessageList.test.tsx`
- Optional: `frontend/src/hooks/` (small long-press helper if inline logic becomes noisy)

## Implementation Slices
1. Convert action rail to absolute overlay so hidden state does not consume width.
2. Replace text action buttons with icon-only buttons + tooltips/aria labels.
3. Add mobile long-press state + menu surface.
4. Wire existing edit/delete/reaction handlers into new UI controls.
5. Update tests for desktop visibility semantics and mobile long-press flow.

## Verification
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
cd frontend && npm test -- MessageList.test.tsx
```

## Decision Locks (Updated)
- Locked: long-press threshold is `350ms`.
- Locked: mobile menu surface is `bottom sheet`.
- Locked: desktop shows a single hover/focus `...` trigger that opens the action shelf.
- Locked: remove mobile fallback `...` trigger (long-press only on coarse pointer).

## Bottom Sheet vs Anchored Popover
- Bottom sheet: a panel that slides up from the bottom of the screen and spans most of the viewport width. Better thumb reach, larger targets, and more reliable on small screens.
- Anchored popover: a small menu visually attached to the pressed message bubble. More contextual, but easier to clip/overflow on narrow screens and harder for one-handed use.
- Recommendation for this task: `bottom sheet` first for mobile reliability and touch ergonomics.

## Decision Brief (Whiteboard)
- Chosen approach: input-modality split (desktop hover `...` + anchored shelf, mobile long-press bottom sheet) with no backend changes.
- Alternative considered: single always-visible overflow button for both desktop and mobile.
- Tradeoff: modality split adds small UI-state complexity but gives cleaner rows and less mobile visual noise.
- Revisit trigger: if long-press discoverability tests fail, reintroduce a mobile fallback trigger.
