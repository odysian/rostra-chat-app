# Issues Workflow

This repository uses PRD -> Task -> PR as the execution control plane.

## Objects

- **PRD** (`type:prd`): feature spec, decision locks, acceptance criteria, and verification plan.
- **Task** (`type:task`): PR-sized implementation unit.
- **Decision** (`type:decision`): short-term decision lock with rationale.

## Core Rules

1. GitHub Issues are the default source of truth for execution. `TASKS.md` is scratchpad only.
2. PRD -> Task -> PR is the default execution model.
3. PRs close Task issues (`Closes #...`), not PRDs.
4. PRDs close only when all child Tasks are done.
5. Default sizing rule: **1 PRD -> 1 Task -> 1 PR**.
6. Tasks are PR-sized; in this workflow, PR-sized usually means end-to-end feature delivery.
7. Phase 3/backend-coupled work requires Decision Locks checked before implementation begins.

## When to Split Into Multiple Tasks

Split only when it clearly improves delivery or risk control:

- change is too large for one PR (guideline: ~600+ LOC or hard to review)
- backend contract should land before frontend integration
- migrations or WebSocket contract changes increase risk
- parallel work or staged rollout is needed

## Fast Lane (Quick Fix Flexibility)

For this personal project, a direct quick-fix path is allowed without mandatory PRD/PR when all are true:

- the change is small and low-risk (single logical fix)
- no schema/API/WebSocket contract change
- no auth/security model change
- no migration/dependency changes
- no ADR-worthy architectural decision

When using Fast Lane:

- run relevant verification for touched areas
- commit with a clear quick-fix message
- push directly to `main` is allowed for personal workflow
- if scope grows, switch back to PRD -> Task -> PR

## Definition of Ready (Task)

A Task can move to `status:ready` when:

- acceptance criteria are written
- verification commands are listed
- dependencies and links are included
- if Phase 3: parent PRD has Decision Locks checked

## Definition of Done (Task)

A Task can be closed when:

- PR is merged
- verification commands pass
- tests and docs for the feature are included in the same Task by default
- docs are updated if required
- follow-ups are created

## Decisions Policy (Locks, Issues, ADRs)

- Default: Decision Locks live as checkboxes in the PRD.
- Use a separate Decision issue only when discussion is non-trivial or reused across PRDs.
- If a decision has lasting architecture/security/performance impact, create an ADR and link it from the PRD (ADR convention: `docs/adr/NNN-kebab-case-title.md`, see `AGENTS.md`).

## Verification Command Source of Truth

Use the Verification section in `AGENTS.md` as the canonical command set.  
Task and PR issue bodies should copy commands from there.

## Codex + GitHub CLI Playbook

If using Codex in VS Code with GitHub CLI, follow `skills/prd-workflow-gh.md` for the end-to-end flow:

- PRD draft
- one default end-to-end Task issue body (optional splits only when criteria apply)
- `gh issue create` command generation
- optional Task execution and PR creation

## Common GitHub CLI Commands

```bash
gh issue create --title "PRD: <feature>" --label "type:prd" --body-file prd-<feature>.md
gh issue create --title "Task: <task title>" --label "type:task,area:frontend" --body-file task-<feature>-01.md
gh issue list --label type:task
gh issue view <id>
```

## Manual GitHub Setup

Recommended labels:

- `type:prd`, `type:task`, `type:decision`, `type:docs`, `type:bug`
- `status:ready`, `status:blocked`, `status:in-progress`, `status:review`, `status:done`
- `area:frontend`, `area:backend`, `area:db`, `area:ws`, `area:tests`, `area:docs`
- `phase:3`

Recommended board columns:

- Backlog -> Ready -> In Progress -> In Review -> Done

## New Project Bootstrap

1. Create issue labels and board columns from this document.
2. Define your stack and repository constraints in `AGENTS.md`.
3. Define canonical verification commands in `AGENTS.md`.
4. Wire `WORKFLOW.md` to reference this file as execution control plane.
5. Open the first PRD issue with scope, acceptance criteria, and Decision Locks.
6. Create one default end-to-end Task issue linked to that PRD.
7. Split into additional Tasks only if the split criteria above apply.
8. Implement by closing Task issues via PRs (`Closes #...`).
9. Close the PRD only after all child Tasks are done.
10. Record lasting architecture/security/performance decisions as ADRs.
11. Keep `TASKS.md` optional and non-authoritative.

## Optional Later

MCP is out of scope for v1. Add it later only to automate issue creation, labeling, or CI summaries.
