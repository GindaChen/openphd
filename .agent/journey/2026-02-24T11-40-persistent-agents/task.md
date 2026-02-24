# Persistent Agent Directories + Sidebar Quick Wins

## Backend: Persistent Agent Storage
- [x] Create two-word ID generator (`lib/agent-id.js`)
- [x] Create `lib/agent-store.js` — CRUD for persistent agent dirs under `.agents/agents/<id>/`
- [x] Modify `agent-sessions.js` to persist sessions to `.agents/agents/` instead of `os.tmpdir()`
- [x] Add REST endpoints: `GET /agents/list`, `GET /agents/detail/:id`
- [x] Write tests for agent-id and agent-store
- [x] Run all tests (78 pass, 0 fail)

## Frontend: Sidebar Quick Wins
- [x] Move settings ⚙ from topbar to sidebar bottom
- [x] Remove "Back to app" ↩ button
- [x] Add agent list panel to sidebar (icon nav + expandable list)

## Verification
- [x] All 78 tests pass
- [x] Frontend builds
- [/] Create branch & PR

## Follow-up
- [ ] Create GitHub issue documenting panel toggle/reorder UX (option B)
- [ ] Copy artifacts to `.agent/journey/`
