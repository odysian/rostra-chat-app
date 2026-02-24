## Feature
Phase 3.5 - Message Reactions (`docs/specs/frontend-design-audit.md`)

## Execution Mode
`single` (default): one Task issue -> one PR -> closes Task issue.

## Goal
Add server-authoritative message reactions end-to-end (DB + API + WS + frontend) with the locked v1 emoji set and deterministic reaction pill behavior.

## Scope
**In:**
- `message_reactions` persistence with uniqueness per (`message_id`, `user_id`, `emoji`).
- Add/remove reaction endpoints for authenticated room members.
- Reaction summary in message payloads (`emoji`, `count`, `reacted_by_me`).
- WS reaction delta events and frontend in-place updates.
- Reaction UI under each message with overflow and ordering rules.
- Backend/frontend tests for authz, deleted-message behavior, sorting, and WS sync.

**Out:**
- Custom emoji picker/full emoji keyboard.
- Optimistic final-state assumptions on client.
- Any non-3.5 feature work.

## Locked Decisions Check (3.5)
- [x] Emoji allowlist: `👍 👎 ❤️ 😂 🔥 👀 🎉`
- [x] Multi-emoji per user (one row per emoji, same user can apply multiple different emojis)
- [x] Authz: authenticated room member can add/remove own reactions
- [x] Deleted message is non-reactable; deleted rows render no reaction controls
- [x] Deleting a message removes its stored reactions
- [x] UI shows max 5 pills, then `+N`
- [x] Pill order: count desc, tie-break by allowlist order
- [x] API shape: explicit add/remove endpoints (`POST`, `DELETE`)
- [x] WS payload contains `room_id`, `message_id`, `emoji`, `user_id`, `count`
- [x] Server-authoritative updates only (no optimistic final state)
- [x] Rate limit: `40/minute` on reaction endpoint family

## Files Planned
Backend:
- `backend/app/models/message_reaction.py` (new model)
- `backend/app/models/message.py` (relationship + cascade)
- `backend/app/models/user.py` (relationship)
- `backend/alembic/versions/*_add_message_reactions_table.py`
- `backend/app/schemas/message.py` (reaction schemas + message response extension)
- `backend/app/crud/message.py` (reaction add/remove + aggregated summary queries)
- `backend/app/api/messages.py` (new endpoints + include reactions in responses)
- `backend/app/websocket/schemas.py` (reaction event payload schemas)
- `backend/tests/test_messages.py` (reaction endpoint + WS + deleted-message behavior tests)

Frontend:
- `frontend/src/types/index.ts` (reaction types + WS reaction events)
- `frontend/src/services/api.ts` (add/remove reaction API calls)
- `frontend/src/hooks/useChatLayoutMessageHandler.ts` (queue reaction WS events for selected room)
- `frontend/src/components/ChatLayout.tsx` (reaction queue state + plumbing)
- `frontend/src/hooks/useMessageFeedLifecycle.ts` (apply reaction deltas server-authoritatively)
- `frontend/src/components/message-list/MessageRow.tsx` (reaction bar + pill rendering + overflow)
- `frontend/src/components/message-list/MessageFeedContent.tsx` (pass reaction handlers/props)
- `frontend/src/components/MessageList.tsx` (invoke reaction APIs, in-flight state, guard deleted rows)
- `frontend/src/components/__tests__/MessageList.test.tsx`
- `frontend/src/components/__tests__/ChatLayout.test.tsx`
- `frontend/src/services/__tests__/api.test.ts`

Docs:
- `backend/TESTPLAN.md` (add reaction cases before writing tests)
- `docs/ARCHITECTURE.md` (new table, endpoints, WS event types)

## Implementation Steps (Checklist)
1. Update `backend/TESTPLAN.md` and frontend test plan section with 3.5 cases.
2. Add DB model + migration for `message_reactions` with unique/index constraints.
3. Extend backend schemas/crud to return ordered reaction summaries in message payloads.
4. Add reaction endpoints with membership + own-reaction checks and `40/minute` rate limit.
5. Emit WS `reaction_added` / `reaction_removed` delta events after successful mutations.
6. Ensure delete flow removes reaction rows (DB cascade + test).
7. Add frontend types/API methods + reaction delta handling in ChatLayout/message lifecycle.
8. Render reaction bar with allowlist, max-5 + `+N`, deterministic sort, deleted-message guard.
9. Add backend/frontend tests for locks and regressions.
10. Run required verification commands and update docs for implemented contracts.

## Verification Plan
Backend:
```bash
make backend-verify
```

Frontend:
```bash
cd frontend && npx tsc --noEmit
cd frontend && npx eslint src/
cd frontend && npm run build
```

## Risks / Notes
- Main correctness risk is drift between API response summaries and WS delta updates; mitigation is server-authoritative summary recalculation on every API response and deterministic WS payload handling.
- Deletion cascade must be enforced at DB level to guarantee reaction cleanup even if deletion path changes later.
