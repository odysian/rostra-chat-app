# Playbook: PRD -> Task Issues

This is a portable procedural playbook. It is not runtime-loaded unless your tooling explicitly loads it.

Given a PRD:

1. Extract backend tasks (schema/api/ws/tests/docs).
2. Extract frontend tasks (types/client/ui/tests/docs).
3. Split into PR-sized Tasks (target 1-4 hours each).
4. Each task must include:
- goal
- scope (in/out)
- acceptance criteria
- verification commands
5. Link each task back to the PRD.
6. If a task exceeds the 1-4 hour target, split before implementation.
