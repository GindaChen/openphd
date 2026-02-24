# Agent Architecture Fix — Walkthrough

## What Changed

### 1. Backend Crash Fix (commit `542022a`)
- `agent-engine.js`: `resolveModel()` guards against stale `api` strings from pi-ai registry
- `agents.js`: Added request logging to `/agents/chat/stream`

### 2. Agent Auto-Creation (commit `d3d3335`)

**Backend:**
- [agent-sessions.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/lib/agent-sessions.js) — sessions now generate human-readable IDs via `generateAgentId()` (e.g. `2026-02-24-11-51-brave-fox`) instead of UUIDs
- [agents.js](file:///Users/mike/Project/GitHub/openphd/services/kanban/routes/agents.js) — added `POST /agents/create` endpoint, updated `/agents/fleet` with agent count, SSE emits `agentId`

**Frontend:**
- [WorkspacePanel.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/detail/WorkspacePanel.jsx) — workspace creation auto-creates a persistent agent (no `prompt()`), stores `agentId`, uses SSE streaming for chat
- [AgentPulse.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/AgentPulse.jsx) — shows agent count in fleet stats

## Architecture (After)

```mermaid
graph TB
    subgraph "Create Workspace"
        WP[WorkspacePanel +] -->|POST /agents/create| BE[Backend]
        BE -->|createAgent| AS[".agents/agents/<br/>brave-fox/"]
        BE -->|{agentId, displayName}| WP
    end

    subgraph "Chat in Workspace"
        WP2[WorkspacePanel chat] -->|"POST /agents/chat/stream<br/>sessionId=brave-fox"| SSE[SSE Stream]
        SSE --> PM[pi-mono Agent]
        PM -->|events| SSE
        SSE -->|streamed text| WP2
    end

    subgraph "Agent Panel"
        AL[AgentListView] -->|GET /agents/list| DIR[".agents/agents/"]
        AP[AgentPulse] -->|GET /agents/fleet| DIR
    end
```

## Agent Folder Structure
```
.agents/agents/
├── memory/shared/entries.json          # shared memory
└── 2026-02-24-11-51-brave-fox/         # per-agent
    ├── config.json    # type, provider, model, workspace
    ├── status.json    # running/stopped/idle
    ├── inbox.jsonl
    ├── outbox.jsonl
    └── history.json   # conversation history
```

## Verification
- ✅ Frontend build passes
- ✅ No dynamic import warnings for WorkspacePanel
