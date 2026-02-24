# Demo Improvements: Onboarding + Agents

Afternoon demo needs three things: (1) a guided onboarding wizard so users know what to do, (2) a visible agent memory panel, and (3) a background agent monitor showing live heartbeat status.

## Proposed Changes

### Onboarding Wizard

#### [NEW] [OnboardingWizard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/onboarding/OnboardingWizard.jsx)
- Multi-step wizard (4 steps) replacing the auto-opened Settings panel for new users
- Step 1: **Welcome** — animated intro, "Let's get started" CTA
- Step 2: **Project Root** — browse/set data directory (reuses existing browse API)
- Step 3: **Connect** — GitHub token + repo, AI API key (both optional, skip-able)
- Step 4: **Ready** — summary of what's configured, keyboard shortcuts cheat sheet, "Go!" button
- Each step has a progress indicator, back/next/skip buttons
- On completion: sets `onboardingDone = true` and calls `onSettingsChange`

#### [MODIFY] [KanbanPage.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/KanbanPage.jsx)
- Import `OnboardingWizard` and show it instead of `SettingsPanel` when `!onboardingDone`
- Keep the settings panel accessible from ⚙ button regardless

---

### Agent Memory Panel

#### [NEW] [MemoryPanel.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/MemoryPanel.jsx)
- Lists agent memory entries from `GET /agents/memory`
- Search bar → `GET /agents/memory/search?q=…`
- "Add memory" form → `POST /agents/memory`
- Delete entries (key-based)
- Shown as a tab in the sidebar or as a dashboard widget

#### [MODIFY] [ContextDashboard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/home/ContextDashboard.jsx)
- Import `MemoryPanel` and render it as a built-in section below widgets

---

### Background Agent Monitor

#### [NEW] [AgentPulse.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/agents/AgentPulse.jsx)
- Compact status indicator: polls `GET /agents/fleet` every 5s
- Shows: running task count, memory entry count, pulsing dot when active
- Expandable to show active task list + recent completed tasks
- Color-coded: green = idle, amber = running, red = error

#### [MODIFY] [ProjectSidebar.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/sidebar/ProjectSidebar.jsx)
- Add `AgentPulse` component to sidebar bottom — always visible heartbeat

---

### CSS

#### [MODIFY] [kanban.css](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/kanban.css)
- Add styles for `.onboarding-*` wizard classes
- Add styles for `.agent-pulse-*` monitor classes
- Add styles for `.memory-panel-*` classes

## Verification Plan

### Automated Tests
```bash
cd /Users/mike/Project/GitHub/openphd/frontend && npm run lint && npx vite build
```

### Manual Verification
1. Clear `localStorage` in browser → refresh → onboarding wizard should appear
2. Walk through all 4 steps → wizard closes → settings are saved
3. Navigate to Home view → memory panel visible below dashboard widgets
4. Check sidebar bottom → agent pulse indicator visible with status
5. Reopen Settings → wizard does NOT reappear, normal settings panel shows
