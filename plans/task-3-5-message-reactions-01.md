## Goal
Deliver Phase 3.5 Message Reactions end-to-end (DB + API + WS + frontend) with deterministic, server-authoritative reaction state.

Suggested labels: `type:task`, `phase:3`, `area:backend`, `area:frontend`, `area:db`, `area:ws`, `area:tests`, `status:ready`

## Scope
**In:**
- Add `message_reactions` storage and migration.
- Add add/remove reaction endpoints for room members.
- Include ordered reaction summary in message payloads.
- Broadcast WS reaction delta events and apply them client-side in place.
- Render reaction pills under messages with lock-defined ordering/overflow behavior.
- Add backend/frontend tests covering authorization, deleted-message constraints, ordering, and realtime updates.

**Out:**
- Full emoji picker.
- Optimistic final-state UI assumptions.
- Non-3.5 feature work.

## Implementation notes
1. Use emoji allowlist constants on backend and frontend: `👍 👎 ❤️ 😂 🔥 👀 🎉`.
2. Enforce uniqueness (`message_id`, `user_id`, `emoji`) and treat client toggle behavior as explicit add/remove API calls.
3. For every API message response, return reaction summary entries sorted by count desc then allowlist order.
4. WS reaction events carry `{ room_id, message_id, emoji, user_id, count }`; frontend updates in place without full reload.
5. Deleted messages are non-reactable and should render with no reaction controls; deletion removes stored reactions.

## Decision locks (backend-coupled only)
- [x] Locked: emoji set includes `👍 👎 ❤️ 😂 🔥 👀 🎉`.
- [x] Locked: per-user model allows multiple different emojis on same message, one row per emoji.
- [x] Locked: non-room-members cannot react.
- [x] Locked: users can only remove their own reactions.
- [x] Locked: deleted messages are non-reactable and render no reaction UI.
- [x] Locked: deleting a message removes stored reactions.
- [x] Locked: UI shows max 5 pills inline, then `+N`.
- [x] Locked: pills sort by count desc with allowlist-order tie breaks.
- [x] Locked: WS payload includes `room_id`, `message_id`, `emoji`, `user_id`, `count`.
- [x] Locked: client is server-authoritative (no optimistic final-state assumptions).
- [x] Locked: reaction endpoints are rate-limited at `40/minute`.
- [x] Locked: backend/frontend tests for these constraints are listed before implementation.

## Acceptance criteria
- [ ] `message_reactions` table exists with required columns, constraints, and indexes.
- [ ] `POST /api/messages/{message_id}/reactions` adds caller reaction for an allowlisted emoji.
- [ ] `DELETE /api/messages/{message_id}/reactions/{emoji}` removes caller's own reaction only.
- [ ] Reaction endpoints enforce room membership and deleted-message non-reactable policy.
- [ ] Message payloads include reaction summary entries with `emoji`, `count`, `reacted_by_me`.
- [ ] WS emits `reaction_added` and `reaction_removed` payloads with locked fields.
- [ ] Frontend renders allowlist controls and reaction pills (max 5 + `+N`) with deterministic ordering.
- [ ] Frontend applies API+WS reaction updates in place and remains server-authoritative.
- [ ] Message deletion clears reaction data and deleted messages do not render reaction controls.
- [ ] Backend/frontend tests cover authz, sorting, deleted-message guard, uniqueness, and realtime updates.
- [ ] Required docs are updated for any schema/API/WS changes.

## Verification
```bash
# Backend
make backend-verify

# Frontend
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
```

## PR checklist
- [ ] PR references this issue (`Closes #...`)
- [ ] Docs updated if needed (`docs/ARCHITECTURE.md`, `docs/PATTERNS.md`, `docs/REVIEW_CHECKLIST.md`, `backend/TESTPLAN.md`, `docs/adr/`)
- [ ] Tests added/updated where needed
