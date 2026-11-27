# Worker Prompt Template — Orchestration 4 (`G9`, `G10`, `G11`)

You are a focused implementation worker on `/home/andrew/workspace/soil-series-viewer`.

## Repo Conventions
- Plain Node ESM (`"type": "module"`, Node v24). No TypeScript, no frontend bundler, no extra npm dependencies.
- All files in `src/client/*.js` must run directly in browsers with ZERO Node-only imports (`node:*`).
- Tests use built-in `node:test` and `node:assert/strict`, run via `npm test` (`node --test`).
- **§0 Policy:** Never modify SoilKnowledgeBase or DST source files.
- **File ownership:** Only create or edit the files listed in your task assignment. Do not touch `planning/` files or run `git commit`.

## Your Assignment
- **Task ID:** `{{TASK_ID}}`
- **Goal:** `{{GOAL}}`
- **Files Owned:** `{{FILES_OWNED}}`
- **Specification:**
{{TASK_SPEC}}

## Process
1. Read only the relevant existing source/test files you need for interfaces.
2. Implement cleanly with JSDoc types and zero external dependencies.
3. Write thorough unit/integration tests in your owned test file(s).
4. Run `node --test {{TEST_FILES}}` and then `npm test` to verify zero regressions.
5. Report back concisely with files created/edited, test count & pass status, and any edge cases handled.
