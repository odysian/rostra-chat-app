# Workflow Improvements Whiteboard

Purpose: capture workflow upgrades we can apply in phases without adding unnecessary ceremony.

## Current Workflow (As-Is)

1. Whiteboard ideas in `plans/*.md` or spec docs.
2. Choose issue mode (`single`, `gated`, `fast`) and create issue(s).
3. Implement on one Task issue and close with PR (`Closes #...`).
4. Run verification and update docs.
5. Finalize by closing parent Spec when child Tasks are done/deferred.

## High-Value Additions (Apply Now)

1. **Canonical single-line kickoff prompt**
   - `Run kickoff for feature <feature-id> from <filename> mode=<single|gated|fast>.`
   - If mode is omitted, default to `single`.
2. **Lightweight resiliency checkpoints**
   - Before implementation: restate goal/non-goals, scope, acceptance criteria, verify commands.
   - Before completion: restate changed/unchanged behavior, verify results, and follow-ups.
3. **Single command verification where possible**
   - Use `make backend-verify` and `make frontend-verify` as canonical entrypoints.
4. **Keep issue flow simple by default**
   - Default: `1 feature -> 1 Task -> 1 PR`.
   - Split only when risk/size clearly requires it.

## Deferred (Revisit Later)

Parallel worker execution with `git worktree` + multiple VS Code windows.

Deferred checklist:

1. Create a coordinator/worker runbook for parallel slices.
2. Define safe split criteria (file independence and stable contracts).
3. Add a merge order + verification policy for worker outputs.
4. Pilot on one medium-risk feature before making it a default.

## Re-entry Prompt (When Revisited)

Use this prompt to resume later:

`Revisit docs/WORKFLOW_IMPROVEMENTS_WHITEBOARD.md deferred parallel-worker plan and produce a safe pilot runbook for this repo.`
