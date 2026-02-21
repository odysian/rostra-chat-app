# Playbook: PRD Workflow (Codex + GitHub CLI)

Use this when starting a new feature and you want PRD + issue creation commands in one run.

## Invocation Shortcut

Example request:

`Run skills/prd-workflow-gh.md for 3.1 New Messages Divider. Produce PRD + 1 task + gh issue create commands.`

## Inputs

- Feature identifier/title (example: `3.1 New Messages Divider`)
- Spec link/section (optional)
- Area labels (optional)

## Output Requirements

1. PRD markdown matching `.github/ISSUE_TEMPLATE/prd.md`
2. **One default Task** markdown body for end-to-end implementation, including:
- suggested labels
- `Parent PRD: (placeholder)`
- acceptance criteria with checkboxes for backend/frontend/tests/docs
3. Optional 0-2 additional Task bodies only when split criteria apply, with split rationale
4. `gh issue create` commands for:
- PRD issue
- Task issue(s) using `--body-file` and `--label`
5. After issue creation, update Task issue body with real `Parent PRD: #<id>` if requested
6. Final execution step:
- start Task `#<id>` in a new branch and open PR with `Closes #<id>`

## Procedure

### A) Draft PRD + Task(s) (text generation)

Ask Codex to:

- draft a lean PRD from the PRD template
- generate one default end-to-end Task
- add optional split Tasks only if split criteria are met
- include labels and acceptance criteria
- include `Parent PRD: (placeholder)` in each Task

### B) Generate GitHub CLI commands

Ask Codex to output:

- filenames to save locally:
  - `prd-<feature>.md`
  - `task-<feature>-01.md` (default)
  - optional `task-<feature>-02.md`, etc.
- `gh issue create` commands using `--body-file` and `--label`

You run those commands in the repo terminal.

### C) Execute a Task

Ask Codex to:

- start Task `#<id>` in a new branch
- implement and verify
- open PR containing `Closes #<id>`

## Common GitHub CLI Snippets

```bash
gh issue create --title "PRD: <feature>" --label "type:prd" --body-file prd-<feature>.md
gh issue create --title "Task: <feature> end-to-end" --label "type:task,area:frontend" --body-file task-<feature>-01.md
gh issue list --label type:task
gh issue view <id>
```
