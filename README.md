# OpenPhD

AI-native research management — a Kanban board with agent-powered orchestration.

## Quick Start

```bash
# Backend
cd services/kanban && npm install

# Frontend
cd frontend && npm install

# Run both (from frontend/)
npm run dev
# → http://localhost:5173
```

## Agent Features

Set `ANTHROPIC_API_KEY` to enable the Master Agent:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

The agent can:
- Create and manage issues via natural language
- Spawn worker agents for complex tasks
- Sync issues with GitHub

## GitHub Sync

Set `GITHUB_TOKEN` and `GITHUB_REPO` to enable bidirectional issue sync:

```bash
GITHUB_TOKEN=ghp_... GITHUB_REPO=owner/repo npm run dev
```

## Architecture

```
frontend/           React + Vite SPA
  └── src/pages/kanban/   Kanban board UI
services/kanban/    Express API server
  ├── lib/          Agent engine, tools, souls
  ├── routes/       REST + SSE endpoints
  └── tests/        61 tests
.agent/             Agent-friendly engineering docs
```

## Testing

```bash
cd services/kanban && node --test tests/*.js    # 61 tests
cd frontend && npx vite build                    # build check
```
