# AGENTS.md — Rostra

## Start Here (Canonical Entrypoint)

`AGENTS.md` is the canonical entrypoint for agents and contributors in this repository.

Read in this order:
1. `AGENTS.md` (this file)
2. `WORKFLOW.md`
3. `docs/ISSUES_WORKFLOW.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PATTERNS.md`
6. `docs/REVIEW_CHECKLIST.md`
7. `skills/write-prd.md`
8. `skills/prd-to-issues.md`
9. `skills/issue-to-pr.md`
10. `skills/prd-workflow-gh.md`

## Unit of Work Rule

- **Unit of work is a GitHub Issue.**
- Choose an execution mode from `docs/ISSUES_WORKFLOW.md` before coding:
  - `single` (default): one feature -> one Task issue -> one PR
  - `gated`: PRD issue + child Task issue(s) for feature sets or higher-risk work
  - `fast`: quick-fix path for tiny low-risk changes
- Convert freeform requests into the selected issue mode before implementation.
- Work one Task issue at a time.
- PRs close Task issues (`Closes #123`), not PRDs.
- PRDs close only when all child Tasks are done or explicitly deferred.
- Detailed control-plane rules are canonical in `docs/ISSUES_WORKFLOW.md`.
- For one-shot issue body + `gh` command generation, use `skills/prd-workflow-gh.md`.

## Agent Operating Loop

1. Whiteboard scope in `plans/*.md` or a spec doc section (scratch only).
2. Choose execution mode (`single` default, `gated`, or `fast`) and create required issue(s).
3. Restate goal and acceptance criteria.
4. Plan minimal files and scope.
5. Implement with tight, surgical changes.
6. Run verification commands.
7. Update tests/docs if required.
8. Open PR that closes the Task issue; close PRD after child Tasks are done/deferred.

## Process

Read and follow `WORKFLOW.md` for the full development process and `docs/ISSUES_WORKFLOW.md` for the issue-control execution modes. Together they define the Design → Test → Implement → Review → Document loop, TDD workflow, technical constraints (SQLAlchemy 2.0, Pydantic v2, async patterns), security requirements, and documentation maintenance rules.

This file contains **project-specific rules** that supplement WORKFLOW.md. If they conflict, this file wins.

---

## Project Context

Rostra is a real-time chat application with multi-room support, unread message tracking, and WebSocket-based messaging.

**Stack:** FastAPI (Python) backend, React + TypeScript + Vite SPA frontend, PostgreSQL, Redis (caching/rate limiting), WebSockets for real-time messaging.

**This is a Vite SPA with react-router-dom, NOT Next.js.** No server components, no `'use client'` directive, no App Router. WORKFLOW.md uses Next.js in its examples — adapt those patterns to Vite/React-Router for this project.

**Deployment:** Vercel (frontend), Render (backend), Supabase (database).

---

## Core Rules

These behavioral rules apply to every task in this project, in addition to WORKFLOW.md's agent operating rules.

- **Simplicity first.** Write the minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No speculative "flexibility" or "configurability." No error handling for impossible scenarios. If you write 200 lines and it could be 50, rewrite it. Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
- **Surgical changes only.** Touch only what the task requires. Don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken. Match existing style, even if you'd do it differently. If you notice unrelated dead code, mention it — don't delete it. Clean up only orphans YOUR changes created (unused imports, variables, functions). Every changed line should trace directly to the user's request.
- **Explain what you're doing.** When writing or modifying code, include brief comments explaining *why* (not just what) for any non-obvious logic. This is a learning environment.
- **Prefer explicit over clever.** Write readable, straightforward code. No one-liners that sacrifice clarity. No premature optimization. No unnecessary abstractions.

## Mentorship Directive

Agents must act as senior developer mentors, not just code generators. For design and implementation responses, include concise reasoning that covers:

- how the change fits the current system design and data flow
- why a specific pattern was chosen and where it should be reused
- security and performance best-practice baseline for this change (and what was applied)
- key tradeoffs and what alternatives were considered

For tiny quick fixes, keep this brief (2-5 lines), but do not skip it.

## Learning Acceleration Checkpoints (Required)

Use these checkpoints to keep speed while building design intuition:

1. **Predict before build:** write a 3-5 line plan before implementation (files, data flow, primary risk).
2. **Decision checkpoint:** if multiple patterns are viable, name 2-3 options and choose one with rationale.
3. **Explain-back before finalize:** summarize system fit, pattern choice, security/performance baseline, and tradeoffs.
4. **Manual rep per feature:** implement at least one small unit manually (test, query, handler, hook, or component logic) without AI generating that part.
5. **Post-merge learning note:** capture one reusable pattern and one improvement for next time.

Fast mode (`fast`) uses a lighter version: keep checkpoints 1-3 in brief form and add a one-line post-change note.

---

## Verification

Before considering any task complete, run the relevant checks:

### Backend (FastAPI/Python)
Preferred: run from repo root:
```bash
make backend-verify
```

If the environment cannot reach PostgreSQL (e.g., restricted sandbox), run:
```bash
make backend-verify SKIP_DB_BOOTSTRAP=1
```
This skips DB-backed test fixtures; DB-dependent tests will be skipped.

Use individual commands from `backend/` only when isolating a specific failure:
```bash
cd backend

# Lint and type check
ruff check .
mypy . --ignore-missing-imports

# Run tests
pytest -v

# Check for security issues
bandit -r app/ -ll
```

### Frontend (React + Vite)
```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint src/

# Build (catches errors that dev mode misses)
npm run build
```

### Database
```bash
cd backend

# Verify migrations are clean
alembic check

# Test migration up/down
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

If any of these fail, fix the issue before moving on.

### Documentation (after every feature)

The files in `docs/` are canonical project guidance. Keep them accurate and aligned with implementation. **Treat doc updates like failing tests.**

- [ ] **ARCHITECTURE.md** — Update if you changed: DB schema, API endpoints, WebSocket events, or system-level concerns (new services, middleware, infrastructure).
- [ ] **PATTERNS.md** — Update if you introduced a new code pattern or changed an existing convention. If you followed an existing pattern unchanged, no update needed.
- [ ] **REVIEW_CHECKLIST.md** — Update if the feature introduced a new category of checks or you discovered a missing check.
- [ ] **backend/TESTPLAN.md** — Update before writing any new tests.
- [ ] **docs/ISSUES_WORKFLOW.md** — Update if issue workflow rules (DoR/DoD, labels, gates) changed.
- [ ] **docs/adr/** — Create a new numbered ADR if you chose between competing approaches, resolved a non-obvious production issue, or made a decision with lasting security/performance consequences. See **ADR Format** below.

**How to update:** Edit the specific section that changed — add new rows to tables, new items to lists, new sections where appropriate. Do not rewrite entire files.

---

## File Structure

See `docs/ARCHITECTURE.md` for the full directory tree with file-level detail. Conventions for where new code goes:

### Backend (FastAPI)
- **Routes** → `app/api/` (one file per domain: `auth.py`, `rooms.py`, `messages.py`)
- **DB models** → `app/models/` (one file per table)
- **Pydantic schemas** → `app/schemas/` (one file per domain, mirrors models/)
- **Query functions** → `app/crud/` (one file per domain, mirrors models/)
- **Business logic** beyond simple CRUD → `app/services/`
- **Framework config** (settings, DB engine, security, Redis, rate limiting) → `app/core/`
- **WebSocket code** (manager, handlers, schemas) → `app/websocket/`
- **Shared helpers** → `app/utils/`

### Frontend (React + Vite)
- **Components** → `src/components/` (one file per component, PascalCase)
- **Context providers** → `src/context/` (Auth, WebSocket)
- **Page-level route components** → `src/pages/`
- **API client and WebSocket service** → `src/services/`
- **Shared TypeScript types** → `src/types/index.ts`
- **Custom hooks** → `src/hooks/`

---

## Planning & Execution

### Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State your assumptions explicitly. If uncertain, ask.
- If multiple valid approaches exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### When a task is vague or spans multiple files

1. **Plan first.** Outline what files will be created/modified, what the data flow looks like, and what the API contract will be. Present the plan as a checklist.
2. **Get approval.** Wait for confirmation before writing code.
3. **Execute step by step.** Complete one checklist item at a time. Run verification after each step.

### When a task is clear and scoped

Just do it. No plan needed. Execute, verify, done.

### Issues Workflow (Control Plane)

- Choose mode first: `single` (default), `gated` (PRD + Tasks), or `fast` (tiny low-risk fixes).
- Default sizing in issue modes: 1 feature -> 1 Task -> 1 PR unless split criteria apply.
- GitHub issues are the execution source of truth. `TASKS.md` is scratchpad-only.
- Follow canonical rules in `docs/ISSUES_WORKFLOW.md` for DoR/DoD and Phase 3 gates.
- Decision Locks live in the controlling issue (Task in `single` mode, PRD in `gated` mode); use Decision issues only for non-trivial/reused discussion.
- If a decision has lasting architecture/security/performance impact, create and link an ADR (`docs/adr/NNN-kebab-case-title.md`).

### Goal-driven execution

Transform tasks into verifiable goals. Define success criteria before writing code.

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with checks:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Common Mistakes to Avoid

_Project-specific lessons. Add to this section when the agent makes a mistake in this repo._

- **Do not install packages without asking first.** State what you want to install and why. Wait for approval.
- **Do not create `.env` files with real secrets.** Create `.env.example` with placeholder values.
- **Do not add dependencies that duplicate existing functionality.** Check what's already installed before adding packages.
- **Do not modify migration files after they've been applied.** Create a new migration instead.
- **Use `make backend-verify` for backend verification by default.** Run individual backend checks only when narrowing down a specific failure.

---

## ADR Format

Architecture Decision Records live in `docs/adr/` and capture decisions with lasting consequences. Use ADR-001 as the canonical example.

**When to write one:**
- You chose between two or more real alternatives (not just "one obvious way")
- A production issue revealed a design flaw that required a deliberate fix
- The decision has non-obvious security, performance, or correctness implications
- Future agents or developers would reasonably question why something was done this way

**When NOT to write one:**
- Routine feature additions with no competing approaches
- Bug fixes with a single obvious solution
- Anything fully covered by PATTERNS.md

**File naming:** `NNN-kebab-case-title.md` — three-digit sequence number, e.g. `004-my-decision.md`. Check the existing files in `docs/adr/` for the next available number.

**Required sections:**

```
# ADR-NNN: Short Title

**Date:** YYYY-MM-DD
**Status:** Accepted | Applied | Superseded by ADR-XXX
**Branch:** branch-name-or-pr

---

## Context

### Background
[What is the relevant architecture or system state?]

### Problem
[What specific issue or requirement triggered this decision?]

### Root Cause (if a bug or production incident)
[Why did the problem occur?]

---

## Options Considered

### Option A: Name
[Description. Accepted/Rejected, and why.]

### Option B: Name
[Description. Accepted/Rejected, and why.]

---

## Decision

[Numbered list of what was implemented and how.]

---

## Consequences

[Bullet list: what is now true as a result, including tradeoffs, edge cases,
and any new risks introduced.]
```

---

_This file is a living document. When the agent does something wrong, add a line to "Common Mistakes to Avoid." The goal: the agent never makes the same mistake twice._
