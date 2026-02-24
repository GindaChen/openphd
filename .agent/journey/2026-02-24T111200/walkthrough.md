# Demo Improvements: Walkthrough

## What Changed

### 1. Onboarding Wizard ([OnboardingWizard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/onboarding/OnboardingWizard.jsx))
- 4-step flow: **Welcome** → **Project Root** → **Connect Services** → **Ready**
- Replaces the old "auto-open Settings on first visit" behavior
- Progress bar with animated transitions between steps
- Test Connection buttons for GitHub and AI
- Saves settings at each step and marks `onboardingDone` on completion

### 2. Agent Pulse ([AgentPulse.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/AgentPulse.jsx))
- Compact heartbeat in sidebar bottom — always visible
- Polls `GET /agents/fleet` every 5s
- Color-coded: green (idle), amber (running), red (error)
- Expandable panel: fleet stats (running/done/pending/memories) + recent tasks list

### 3. Memory Panel ([MemoryPanel.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/MemoryPanel.jsx))
- Lives below dashboard widgets in Home view
- Search memories, add new ones (key/content/tags), view all entries
- Connected to `GET/POST /agents/memory` and `GET /agents/memory/search`

## Files Modified
| File | Change |
|---|---|
| [KanbanPage.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/KanbanPage.jsx) | Import wizard, show overlay when `!onboardingDone` |
| [ProjectSidebar.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/sidebar/ProjectSidebar.jsx) | Added `AgentPulse` to sidebar bottom |
| [ContextDashboard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/home/ContextDashboard.jsx) | Added `MemoryPanel` below widgets |
| [kanban.css](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/kanban.css) | +880 lines for all 3 components |

## Verification
- **Lint**: ✅ No errors (warnings only, pre-existing)
- **Build**: ✅ 71 modules, 668ms
- **CI**: ✅ [Run 22365844956](https://github.com/GindaChen/openphd/actions/runs/22365844956) — all green
- **Commit**: `6c07bb5` pushed to `main`
