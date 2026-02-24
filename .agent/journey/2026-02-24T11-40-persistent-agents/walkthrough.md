# Walkthrough: Persistent Agent Directories + Sidebar UI

## What was shipped

**PR [#2](https://github.com/GindaChen/openphd/pull/2)** — merged to main, CI green.

### Backend: Persistent Agent Storage

| File | What it does |
|------|-------------|
| [agent-id.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-id.js) | Human-readable IDs: `2026-02-24-11-35-21-brave-fox` (60 adj × 60 nouns) |
| [agent-store.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-store.js) | CRUD for `.agents/agents/<id>/` dirs with config, status, inbox, outbox, history |
| [agent-sessions.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-sessions.js) | Now persists to `.agents/agents/` instead of `os.tmpdir()` |
| [agents.js routes](file:///Users/mike/Project/GitHub/openphd/services/kanban/routes/agents.js) | Added `GET /agents/list`, `GET /agents/detail/:id`, uses `generateAgentId()` |

**Agent directory structure:**
```
.agents/agents/<agentId>/
├── config.json      ← type, soul, model, created timestamp
├── status.json      ← current state, last heartbeat
├── inbox.jsonl      ← messages TO this agent
├── outbox.jsonl     ← messages FROM this agent
└── history.json     ← conversation history
```

### Frontend: Sidebar Changes

| Change | Before | After |
|--------|--------|-------|
| Settings | ⚙ in topbar (top-right) | ⚙ in sidebar (bottom) |
| Back button | ↩ "Back to app" in sidebar | Removed |
| Agents nav | None | 🤖 nav item → `AgentListView` |

### Other
- Created [/quick-win workflow](file:///Users/mike/Project/GitHub/openphd/.agent/workflows/quick-win.md)
- Follow-up issue [#3](https://github.com/GindaChen/openphd/issues/3) for panel toggle/reorder UX

## Testing

- **78 tests** pass (17 new + 61 existing), 0 fail
- Frontend builds clean (74 modules)
- CI: 1/1 checks passed
