# AGENTS.md — OpenPhD

## Onboarding

Before doing anything, run `/onboard` or read these files in order:

1. `.agent/workflows/repo-overview.md` — architecture and structure
2. `.agent/workflows/feature-dev.md` — how to ship changes
3. `.agent/journey/final-reflection/` — patterns and gotchas and who you are

## Architecture

```
frontend/                 React + Vite (port 5173)
  src/pages/kanban/       Kanban board UI (the entire app)
services/kanban/          Express API (port 3001)
  lib/agent-engine.js     pi-mono agent factories
  lib/tools/              Tool categories: kanban/, orchestration/, coding/, communication/
  lib/souls/              Agent system prompts (markdown templates)
  routes/                 REST + SSE endpoints
  tests/                  61 tests
data/kanban/              Runtime data (auto-bootstrapped)
```

## Commands

```bash
# Run everything (from frontend/)
npm run dev

# Backend tests
cd services/kanban && node --test tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js

# Frontend build
cd frontend && npx vite build
```

## Workflows

| Command | Purpose |
|---------|---------|
| `/onboard` | Read docs, verify environment, get oriented |
| `/feature-dev` | Full PR cycle: code → test → branch → push → CI → merge |
| `/ci-babysit` | Poll CI until green, fix failures in a loop |
| `/repo-overview` | Detailed architecture reference |

## Conventions

- **Commits**: `type(scope): message` — e.g. `feat(kanban):`, `fix(sync):`, `ci:`
- **PRs**: Always squash-merge via `gh pr merge N --squash --delete-branch --admin`
- **CSS classes**: `kb-` prefix — e.g. `kb-card`, `kb-ask-panel`
- **Tools**: Factory functions in `lib/tools/`, composed via `createMasterTools(ctx)`
- **Souls**: Markdown in `lib/souls/`, loaded via `loadSoul(name, vars)`
- **Tests**: Explicit file list in CI (no globs), add new test files to `ci.yml`

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | For agent | Master agent LLM |
| `GITHUB_TOKEN` | For sync | GitHub issue sync |
| `GITHUB_REPO` | For sync | Target repo (`owner/repo`) |
| `KANBAN_PORT` | Optional | API port (default: 3001) |

## Rules

- Unless explicitly spoken otherwise, do not use browser to validate your result or generate a walkthrough unless absolutely necessary.

## Memory

- `.agent/journey/final-reflection/` — lessons from the sandbox project
- `.agent/souls/execution-agent.md` — agent identity and principles
- `.agent/workflows/` — executable workflow definitions
