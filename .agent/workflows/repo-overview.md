---
description: Generate a high-level architecture overview of this repo
---

## Architecture

This is a Kanban board for research management, with an integrated AI agent system.

### Frontend (`frontend/`)
- **React + Vite** single-page app
- Single page: `src/pages/kanban/KanbanPage.jsx` — the Kanban board
- Components: `board/`, `chat/`, `detail/`, `palette/`, `settings/`, `widgets/`
- State: `store/kanbanData.js` — React context + reducer
- API layer: `store/api.js` — fetch wrapper with `/api/kanban` prefix

### Backend (`services/kanban/`)
- **Express** API server on port 3001
- Routes:
  - `issues.js` — REST CRUD for issues
  - `agents.js` — SSE streaming for agent chat, workspace spawn, queue feed
  - `chat.js` — Legacy LLM chat (OpenAI-style, fallback)
  - `github-sync.js` — Bidirectional GitHub issue sync with pagination
- Agent system:
  - `lib/agent-engine.js` — Agent factories (Master, Workspace, Worker)
  - `lib/agent-sessions.js` — Session lifecycle
  - `lib/agent-mailbox.js` — JSONL inter-agent messaging
  - `lib/souls/` — 5 soul templates
  - `lib/tools/` — 4 tool categories (kanban, orchestration, communication, coding)

### Data (`data/kanban/`)
- `board.json` — column definitions, labels, priorities
- `issues/` — one JSON + one MD per issue
- `.meta.json` — auto-incrementing ID counter
- Bootstrapped automatically on first run

### Tests
- 61 tests across 6 files in `services/kanban/tests/`
- Run: `cd services/kanban && node --test tests/*.js`
