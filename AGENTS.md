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
```bash
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

## Code Style

### Python (Backend)
- Use type hints on all function signatures
- Use Pydantic models for request/response validation (never accept raw dicts from users)
- Use dependency injection for database sessions, auth, etc.
- Async endpoints by default (`async def`)
- Error responses use consistent format: `{"detail": "Human-readable message"}`
- Environment variables via `pydantic-settings`, never hardcoded secrets
- Logging over print statements

### TypeScript (Frontend)
- Explicit types — avoid `any`. If you must, use `unknown` and narrow
- Functional components with hooks (no class components)
- Props interfaces defined above component: `interface Props { ... }`
- Use `'use client'` directive only when actually needed (prefer server components in Next.js App Router)
- Fetch data in server components or route handlers, not in `useEffect` when avoidable
- Error boundaries for user-facing components

### SQL/Database
- All schema changes go through Alembic migrations — never modify the database directly
- Index any column used in WHERE clauses or JOINs on tables expected to grow
- Use `BIGINT` for primary keys on new tables (not `INTEGER`)
- Foreign keys always have `ON DELETE` behavior specified
- Never store passwords in plaintext — use bcrypt

## File Structure Conventions

### Backend (FastAPI)
```
app/
├── main.py              # App factory, middleware, CORS
├── config.py            # Settings via pydantic-settings
├── database.py          # Engine, session, Base
├── models/              # SQLAlchemy models (one file per domain)
├── schemas/             # Pydantic request/response models
├── routers/             # Route handlers (one file per domain)
├── services/            # Business logic (keep routers thin)
├── dependencies/        # FastAPI dependencies (auth, db session)
├── middleware/           # Custom middleware
└── utils/               # Shared helpers
```

### Frontend (Next.js App Router)
```
src/
├── app/                 # App router pages and layouts
│   ├── layout.tsx
│   ├── page.tsx
│   └── (routes)/
├── components/          # Reusable UI components
│   ├── ui/              # Primitives (Button, Input, Card)
│   └── features/        # Feature-specific components
├── lib/                 # Utilities, API client, types
├── hooks/               # Custom React hooks
└── styles/              # Global styles if needed
```

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

---

_This file is a living document. When the agent does something wrong, add a line to "Common Mistakes to Avoid." When you find a better verification command, update the Verification section. The goal: the agent should never make the same mistake twice._
