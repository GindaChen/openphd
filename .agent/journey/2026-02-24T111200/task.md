# Demo Improvements: Onboarding + Agent System

## 1. Onboarding Wizard
- [x] Create `OnboardingWizard.jsx` — a step-by-step guided setup flow
- [x] Step 1: Welcome + project root selection
- [x] Step 2: GitHub integration (optional)
- [x] Step 3: AI assistant API key
- [x] Step 4: "You're ready!" with quick-start tips
- [x] Wire into `KanbanPage` — show wizard instead of settings when `!onboardingDone`
- [x] Add CSS for the wizard

## 2. Agent Memory Panel
- [x] Create `MemoryPanel.jsx` — view/add/search agent memory entries
- [x] Wire into sidebar or dashboard as a visible panel
- [x] Connect to existing `/agents/memory` API

## 3. Background Agent Monitor
- [x] Create `AgentMonitor.jsx` — live heartbeat/status widget
- [x] Poll `/agents/fleet` on interval to show running tasks
- [x] Add to ContextDashboard or sidebar as always-visible indicator
- [x] Add a "background pulse" indicator in sidebar

## 4. Verification
- [x] Frontend builds cleanly (`npm run lint && npx vite build`)
- [x] Visual check in browser
