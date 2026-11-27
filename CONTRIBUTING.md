# Contributing

Thank you for contributing to `soil-series-viewer`. See [README.md](README.md) for project overview, [Makefile](Makefile) for commands, and [AGENTS.md](AGENTS.md) for the codebase map and environment variables.

## Setup

1. Install **Node.js 24+** (no `npm install` needed — the project has zero external dependencies).
2. Clone the upstream repositories listed in [README.md](README.md) into sibling directories, or point to custom paths using the environment variables in [AGENTS.md](AGENTS.md).
3. Verify your setup:

```bash
make test
```

## Development Standards

- **Modules:** Plain ES modules (`"type": "module"`). Keep `src/client/*.js` browser-safe with zero `node:*` imports.
- **Tests:** Add or update `node:test` coverage under `test/` for every behavioral change. Run `make test` before committing.
- **CSS:** Keep stylesheets (`src/styles/*.css`) valid with balanced braces and print-safe rules for interactive UI.
- **Commits:** Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `ci:`, `refactor:`, `test:`).

## Pull Requests

1. Branch from `main` and keep commits focused on a single logical change.
2. Ensure `make test` passes locally.
3. CI (`.github/workflows/test.yml`) runs the full test suite against shallow-cloned upstream data on every push and pull request.
