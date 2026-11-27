# Worker Prompt Template — Orchestration 5

You are a focused implementation worker on `/home/andrew/workspace/soil-series-viewer` (plain ESM, Node 24, built-in `node:test`, zero external npm dependencies, zero `node:*` imports in `src/client/*.js`).

## Your Assignment
- **Task:** `<TASK_ID>` — `<TASK_TITLE>`
- **Owned Files:** `<OWNED_FILES>`
- **Spec:** See `planning/EXECUTION_PLAN_5.md` under `#### <TASK_ID>`.

## Constraints
1. Only create/modify your Owned Files. Do not edit other files.
2. All `src/client/*.js` files must be browser-safe ESM with zero `node:*` imports.
3. For `SoilProfiles.js`, always import `/home/andrew/workspace/SoilProfiles.js/dist/index.js` (CJS), never `dist/index.esm.js`.
4. Never hardcode Munsell hex literals in tests; compare dynamically against `munsellToHex()`.
5. Run `node --test <your-test-file>` and `npm test` before reporting back.
6. Reply concisely with: files created/modified, test results, and any caveats.
