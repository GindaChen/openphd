# Agent Soul Panel — Walkthrough

## What Was Built
A new **Agent Soul panel** — the center column of the agent view — that displays an agent's persona, identity, memory, and available tools.

### Layout Change
The agent view is now a **three-column layout**:

| Column | Content |
|--------|---------|
| **Left** | Agent list sidebar (compact, clickable) |
| **Center** | Soul panel (persona, tools, info) |
| **Right** | Chat grid (open agent conversations) |

**Interaction model**: Single-click selects an agent → shows soul. Double-click opens agent in chat grid.

---

## Files Changed

### Backend

#### [agent-store.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-store.js)
Added 3 functions:
- `saveSoul(agentId, content)` — write soul.md to agent dir
- `loadSoul(agentId)` — read soul.md from agent dir
- `listSoulTemplates()` — enumerate markdown templates from `lib/souls/`

#### [agents.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/routes/agents.js)
Added 5 new API endpoints:
- `GET /agents/detail/:id/soul` — read agent soul
- `PUT /agents/detail/:id/soul` — save agent soul
- `GET /agents/soul-templates` — list available soul templates
- `POST /agents/detail/:id/soul/fork` — fork a template (with variable substitution)
- `GET /agents/tools` — list tool categories + LLM tools

### Frontend

#### [AgentSoulPanel.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/AgentSoulPanel.jsx) [NEW]
Main component with 3 tabs:
- **🪶 Soul** — Markdown editor with preview/edit modes, template picker
- **🔧 Tools** — Collapsible categories showing available tools/extensions
- **ℹ️ Info** — Agent metadata card (ID, type, model, provider, workspace)

#### [AgentListView.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/AgentListView.jsx)
- Added `selectedId` state for soul panel selection
- Single-click → select agent → show soul; double-click → open in chat grid
- New center column with soul panel wrapper + collapse/expand controls
- Added second resizable panel for soul column

#### [kanban.css](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/kanban.css)
~600 lines of new CSS for:
- Center column layout (`.ag-view-center`)
- Soul panel component (`.soul-panel-*`)
- Soul editor with preview/edit tabs (`.soul-editor-*`)
- Template picker cards (`.soul-template-*`)
- Tools panel with collapsible categories (`.soul-tool-*`)
- Agent info card (`.soul-info-*`)

---

## Verification
- ✅ **Backend**: 61/61 tests pass
- ✅ **Frontend**: `vite build` clean (612ms, 75 modules)
