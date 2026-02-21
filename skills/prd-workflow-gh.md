# Playbook: PRD Workflow (Codex + GitHub CLI)

Use this when starting a new feature and you want PRD + Task issues + `gh` commands in one run.

## Invocation Shortcut

Example request:

`Run skills/prd-workflow-gh.md for 3.1 New Messages Divider. Produce PRD + 6-8 tasks + gh issue create commands.`

## Inputs

- Feature identifier/title (example: `3.1 New Messages Divider`)
- Spec link/section (optional)
- Area labels (optional)

## Output Requirements

1. PRD markdown matching `.github/ISSUE_TEMPLATE/prd.md`
2. 6-8 Task issue markdown bodies (1-4 hours each), each with:
- suggested labels
- acceptance criteria
- verification section
- `Parent PRD: (placeholder)` until PRD issue number exists
3. `gh issue create` commands for:
- PRD issue
- each Task issue (use `--body-file` and `--label`)
4. After issue creation, update Task issue bodies with real `Parent PRD: #<id>` if requested
5. On request, start first Task (branch -> implement -> PR with `Closes #<task-id>`)

## Procedure

### A) Draft PRD + Tasks (text generation)

Ask Codex to:

- draft a lean PRD from the PRD template
- generate 6-8 PR-sized Task issues (1-4 hours each)
- include labels and acceptance criteria
- include `Parent PRD: (placeholder)` in each Task

### B) Generate GitHub CLI commands

Ask Codex to output:

- filenames to save locally:
  - `prd-<feature>.md`
  - `task-<feature>-01.md`, etc.
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
gh issue create --title "Task: <task title>" --label "type:task,area:frontend" --body-file task-<feature>-01.md
gh issue list --label type:task
gh issue view <id>
```
