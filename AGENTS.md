# AGENTS.md

## Project Context

This is a learning-focused development environment. The developer (Chris) is a career changer building portfolio projects to land a junior developer role. Code quality, security, and understanding matter more than speed.

**Stack:** FastAPI (Python) backend, Next.js + TypeScript frontend, PostgreSQL (with pgvector where needed), Tailwind CSS, deployed to Vercel/Render/Supabase or AWS (EC2/RDS/S3 with Terraform).

## Core Rules

- **Never skip security.** Every endpoint must validate input, sanitize output, and handle errors. Never trust user input. Always use parameterized queries (SQLAlchemy handles this — never raw string interpolation for SQL). Always set CORS, rate limiting, and CSRF protection.
- **One feature at a time.** Do not implement multiple features in a single session. Break work into the smallest shippable unit: one endpoint, one component, one migration.
- **Explain what you're doing.** When writing or modifying code, include brief comments explaining *why* (not just what) for any non-obvious logic. This is a learning environment.
- **Do not "draw the owl."** Never produce a massive diff that touches 10+ files at once. If the task requires touching many files, produce a plan first, then execute file by file.
- **Prefer explicit over clever.** Write readable, straightforward code. No one-liners that sacrifice clarity. No premature optimization. No unnecessary abstractions.

## Verification

Before considering any task complete, run the relevant checks:

### Backend (FastAPI/Python)
Run these commands from the `backend/` directory:
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

### Frontend (Next.js/TypeScript)
```bash
# Type check
npx tsc --noEmit

# Lint
npx next lint

# Build (catches errors that dev mode misses)
npm run build
```

### Database
```bash
# Verify migrations are clean
alembic check  # or: alembic heads (should show single head)

# Test migration up/down
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

If any of these fail, fix the issue before moving on. Do not leave broken tests, lint errors, or type errors behind.

### Documentation (after every feature)
The files in `docs/` are auto-loaded into every conversation via CLAUDE.md. Keeping them accurate eliminates the repeated file reads a fresh session otherwise needs to understand the codebase. **This is not optional — treat doc updates like failing tests.**

- [ ] **ARCHITECTURE.md** — Update if you changed: DB schema (tables, columns, indexes), API endpoints (new/modified routes, request/response shapes), WebSocket events (new actions or event types), or system-level concerns (new services, middleware, infrastructure).
- [ ] **PATTERNS.md** — Update if you introduced a new code pattern, changed an existing convention, or added a new naming convention. If you followed an existing pattern unchanged, no update needed.
- [ ] **REVIEW_CHECKLIST.md** — Update if the feature introduced a new category of checks (e.g. file uploads, rate limiting) or if you discovered a check that was missing.
- [ ] **TESTPLAN.md** — Update before writing any new tests (existing rule, listed here for completeness).

**How to update:** Edit the specific section that changed — add new rows to tables, new items to lists, new sections where appropriate. Do not rewrite entire files. Keep the same structure and formatting.

## Code Style

### Python (Backend)
- Use type hints on all function signatures
- Use Pydantic models for request/response validation (never accept raw dicts from users)
- Use dependency injection for database sessions, auth, etc.
- Async endpoints by default (`async def`)
- Error responses use consistent format: `{"detail": "Human-readable message"}`
- Environment variables via `pydantic-settings`, never hardcoded secrets
- Logging over print statements

### TypeScript (Frontend — React + Vite SPA)
- Explicit types — avoid `any`. If you must, use `unknown` and narrow
- Functional components with hooks (no class components)
- Props interfaces defined above component: `interface Props { ... }`
- This is a Vite SPA with react-router-dom, **not** Next.js — no server components, no `'use client'` directive
- Error boundaries for user-facing components

### SQL/Database
- All schema changes go through Alembic migrations — never modify the database directly
- Index any column used in WHERE clauses or JOINs on tables expected to grow
- Use `BIGINT` for primary keys on new tables (not `INTEGER`)
- Foreign keys always have `ON DELETE` behavior specified
- Never store passwords in plaintext — use bcrypt

## File Structure Conventions

See ARCHITECTURE.md (auto-loaded via CLAUDE.md) for the **actual** directory tree with file-level detail. The conventions below describe where new code should go:

### Backend (FastAPI)
- **Routes** go in `app/api/` (one file per domain: `auth.py`, `rooms.py`, `messages.py`)
- **DB models** go in `app/models/` (one file per table)
- **Pydantic schemas** go in `app/schemas/` (one file per domain, mirrors models/)
- **Query functions** go in `app/crud/` (one file per domain, mirrors models/)
- **Business logic** beyond simple CRUD goes in `app/services/`
- **Framework config** (settings, DB engine, security, Redis, rate limiting) lives in `app/core/`
- **WebSocket** code (manager, handlers, schemas) lives in `app/websocket/`
- **Shared helpers** go in `app/utils/`

### Frontend (React + Vite)
- **Components** go in `src/components/` (one file per component, PascalCase)
- **Context providers** go in `src/context/` (Auth, WebSocket)
- **Page-level route components** go in `src/pages/`
- **API client and WebSocket service** go in `src/services/`
- **Shared TypeScript types** go in `src/types/index.ts`
- **Custom hooks** go in `src/hooks/`

## Common Mistakes to Avoid

_Add to this section whenever the agent makes a mistake. Each line prevents a repeat._

- **Do not install packages without asking first.** State what you want to install and why. Wait for approval.
- **Do not create `.env` files with real secrets.** Create `.env.example` with placeholder values and document what each variable does.
- **Do not use `console.log` for error handling.** Use proper error boundaries (frontend) or structured logging (backend).
- **Do not write tests that only test the happy path.** Include at least one error case and one edge case per function tested.
- **Do not use `*` imports.** Always import specific names.
- **Do not add dependencies that duplicate existing functionality.** Check what's already installed before adding packages.
- **Do not create API routes without authentication unless explicitly told the route is public.**
- **Do not use string concatenation for URLs or file paths.** Use `urllib.parse` / `pathlib` (Python) or template literals with proper encoding (TypeScript).
- **Do not modify migration files after they've been applied.** Create a new migration instead.
- **Do not catch broad exceptions and silently swallow them.** Log the error and re-raise or return a proper error response.

## Planning vs Execution

When a task is vague or spans multiple files:

1. **Plan first.** Outline what files will be created/modified, what the data flow looks like, and what the API contract will be. Present the plan as a checklist.
2. **Get approval.** Wait for confirmation before writing code.
3. **Execute step by step.** Complete one checklist item at a time. Run verification after each step.

When a task is clear and scoped (fix a bug, add a field, write one test):

1. **Just do it.** No plan needed. Execute, verify, done.

## Git Conventions

- Commit messages: `type: short description` (e.g., `feat: add document upload endpoint`, `fix: handle empty PDF gracefully`, `refactor: extract chunking logic to service`)
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`
- One logical change per commit — don't bundle unrelated changes
- Never commit `.env`, `node_modules`, `__pycache__`, or `.next/`

## Security Checklist (Apply to Every Feature)

- [ ] Input validation (Pydantic models, Zod schemas, or equivalent)
- [ ] Output encoding/sanitization (XSS prevention)
- [ ] Authentication check on protected routes
- [ ] Authorization check (user can only access their own resources)
- [ ] Rate limiting on public-facing endpoints
- [ ] File upload validation (type, size, content — not just extension)
- [ ] No secrets in code or logs
- [ ] HTTPS-only in production
- [ ] SQL injection prevention (parameterized queries only)
- [ ] CORS configured to specific origins (not `*` in production)

## Environment & Deployment

- **Local dev:** Docker Compose for PostgreSQL/Redis, uvicorn for FastAPI, `npm run dev` for Next.js
- **Staging/Production targets:** Vercel (frontend), Render (backend), Supabase (database) — OR — AWS (EC2, RDS, S3) with Terraform
- **Environment variables:** Always use `.env.example` as the template. Never hardcode connection strings, API keys, or secrets.
- **Database:** Alembic for all migrations. `alembic upgrade head` must succeed cleanly on a fresh database.

## Testing Rules
- Never write a test without a corresponding entry in TESTPLAN.md
- Every test function must have a descriptive name that explains
  what it verifies without reading the test body
- Every test must include at least one assertion on the response
  body, not just status codes
- Do not mock the database — use a real test database with
  transactions that roll back
- Do not write tests that only verify the happy path

---

_This file is a living document. When the agent does something wrong, add a line to "Common Mistakes to Avoid." When you find a better verification command, update the Verification section. The goal: the agent should never make the same mistake twice._
