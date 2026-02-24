# Persistent Agent Directories + Sidebar Quick Wins

Make agent sessions persistent on disk under `.agents/agents/<id>/` and add sidebar UI improvements.

## Proposed Changes

### Agent ID Generator

#### [NEW] [agent-id.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-id.js)

Two-word human-readable IDs: `2026-02-24-11-35-21-brave-fox`

- Word lists: ~60 adjectives × ~60 nouns = 3,600 combos
- Format: `YYYY-MM-DD-HH-MM-SS-<adj>-<noun>`
- Export: `generateAgentId()` → string

---

### Agent Store (persistent CRUD)

#### [NEW] [agent-store.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-store.js)

Manages persistent agent directories:
```
.agents/agents/<agentId>/
├── config.json      ← type, soul, model, created timestamp
├── status.json      ← current state, last heartbeat
├── inbox.jsonl      ← messages TO this agent
├── outbox.jsonl     ← messages FROM this agent
└── history.json     ← conversation history
```

Functions:
- `createAgent(config)` → creates dir, writes config.json, returns agentId
- `loadAgent(agentId)` → reads config + status
- `listAgents(baseDir)` → scans dirs, returns array of agent summaries
- `deleteAgent(agentId)` → removes dir

---

### Session Persistence

#### [MODIFY] [agent-sessions.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-sessions.js)

- Change `mailboxBase` from `os.tmpdir()` to `.agents/agents/`
- On session create → call `agentStore.createAgent()` to persist
- On session load → check disk for existing agents

---

### REST Endpoints

#### [MODIFY] [agents.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/routes/agents.js)

- `GET /agents/list` → return all persisted agents with config + status
- `GET /agents/:id` → return single agent detail (config, status, recent messages)

---

### Frontend Sidebar

#### [MODIFY] [ProjectSidebar.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/sidebar/ProjectSidebar.jsx)

- Add ⚙ settings button to bottom section
- Remove ↩ "Back to app" link
- Add 🤖 agent list nav item

#### [MODIFY] [KanbanPage.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/KanbanPage.jsx)

- Remove ⚙ from topbar
- Wire settings button in sidebar to `setSettingsOpen(true)`

---

### Tests

#### [NEW] [test_agent_store.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/tests/test_agent_store.js)

- ID format validation
- Create/load/list/delete agent lifecycle
- History persistence

## Verification Plan

### Automated Tests
```bash
cd services/kanban && node --test tests/test_agent_store.js tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js
cd frontend && npx vite build
```
