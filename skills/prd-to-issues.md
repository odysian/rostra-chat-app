# Playbook: PRD -> Task Issues

This is a portable procedural playbook. It is not runtime-loaded unless your tooling explicitly loads it.

Given a PRD:

1. Default plan: generate **one primary Task** for end-to-end delivery (backend + frontend + tests + docs).
2. Optional split plan: generate 0-2 extra Tasks only when split criteria apply (size/risk/dependency/parallelization), and explain why.
3. Task acceptance criteria should include checkboxes for:
- backend work (if applicable)
- frontend work (if applicable)
- tests
- docs
4. Each Task must include:
- goal
- scope (in/out)
- acceptance criteria
- verification commands
- `Parent PRD: (placeholder)` until real PRD issue ID exists
5. Output format must clearly show:
- `Default plan: single Task`
- `Optional split plan (only if needed): ...`
