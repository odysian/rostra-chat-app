# Playbook: Issue -> PR Execution

This is a portable procedural playbook. It is not runtime-loaded unless your tooling explicitly loads it.

Given a Task issue:

1. Restate goal and acceptance criteria.
2. Identify files to touch and verification commands.
3. Make minimal, surgical changes.
4. Add/update tests as required by scope.
5. Run verification commands.
6. Commit implementation changes and open PR with `Closes #<task-issue-number>`.
7. Trigger a fresh-context review agent/session on the PR branch.
8. Patch notable findings on the same branch, commit as `fix(review-r<round>): <finding title>`, and re-run verification.
9. Repeat review/patch at most one additional round (`max_review_rounds=2`, `max_auto_patch_commits=2`), then stop.
10. Document each round in the PR (findings, severity, disposition, commits/follow-ups) and update docs/ADR links when applicable.
