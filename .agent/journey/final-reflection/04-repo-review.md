# Final Repo Review — sandbox-whisper-transcriber

## What This Repo Became

Started as a whisper transcription demo. Evolved into an AI-native research management platform with a Kanban board, multi-agent orchestration, and a plugin architecture.

## Architecture

```
sandbox-whisper-transcriber/
├── frontend/                   React + Vite SPA
│   └── src/pages/kanban/       ← THE FEATURE TO MIGRATE
│       ├── components/
│       │   ├── board/          KanbanBoard, IssueCard, TeamItemsView, TimelineView
│       │   ├── chat/           MasterChat, ToolChip, PromptDebug, AgentQueueFeed
│       │   ├── detail/         IssueDetailPanel
│       │   ├── palette/        CommandPalette
│       │   ├── settings/       SettingsPanel, AISettingsSection
│       │   └── widgets/        WidgetRenderer, widget templates
│       ├── hooks/              useResizable
│       ├── store/              kanbanData, api, settings
│       ├── utils/              renderMarkdown
│       ├── KanbanPage.jsx      Main page orchestrator
│       └── kanban.css          ~3800 lines of styles
│
├── services/kanban/            Node.js + Express backend
│   ├── lib/
│   │   ├── agent-engine.js     Agent factory functions (Master, Workspace, Worker)
│   │   ├── agent-mailbox.js    JSONL-based inter-agent messaging
│   │   ├── agent-sessions.js   Session lifecycle management
│   │   ├── helpers.js          JSON/MD read-write utilities
│   │   ├── project.js          Project bootstrap, issue CRUD
│   │   ├── souls/              5 soul templates (project-master, workspace-main, worker, code-agent, master)
│   │   └── tools/
│   │       ├── kanban/         createIssue, moveIssue, listIssues, boardSummary
│   │       ├── admin/          getWorkerOutput, listWorkers (enhanced)
│   │       └── index.js        Tool composition (createMasterTools, createKanbanTools, etc.)
│   ├── routes/
│   │   ├── agents.js           SSE streaming, workspace spawn, queue feed
│   │   ├── chat.js             Legacy LLM chat (OpenAI-style)
│   │   ├── github-sync.js      Bidirectional GitHub sync with pagination
│   │   └── issues.js           REST CRUD for issues
│   ├── server.js               Express entry point
│   └── tests/                  61 tests across 6 test files
│
├── .github/workflows/
│   └── deploy.yml              CI: npm install → 61 tests → Vite build
│
├── .agent/
│   ├── journey/                87 iteration snapshots
│   └── workflows/              2 workflow definitions
│
└── data/kanban/                Runtime data (issues, board config)
```

## Test Coverage

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| test_project.js | 20 | Issue CRUD, board bootstrap, ID generation |
| test_chat.js | 10 | Chat message persistence |
| test_agent_mailbox.js | 5 | Agent registration, mailbox I/O |
| test_admin_tools.js | 8 | Worker listing, output retrieval |
| test_kanban_tools.js | 8 | createIssue, moveIssue, listIssues, boardSummary |
| test_github_sync.js | 10 | Pagination, PR filtering, priority detection, disk CRUD |
| **Total** | **61** | |

## What to Migrate (for Kanban feature)

### Must Copy
- `frontend/src/pages/kanban/` — entire directory (components, store, hooks, utils, CSS)
- `services/kanban/` — entire directory (lib, routes, tests, server.js)
- `data/kanban/` — runtime data directory structure (or bootstrap script)

### Must Adapt
- `frontend/src/pages/registry.js` — route registration for the kanban page
- `frontend/src/App.jsx` — top-level routing
- `.github/workflows/deploy.yml` — CI pipeline
- `package.json` (both root and services/kanban) — dependencies

### Can Drop
- `services/whisper/` — transcription service (not needed)
- `services/pi-chat/` — standalone chat app (not needed)
- `.worktrees/` — development worktrees
- Most of `.agent/journey/` — history snapshots (keep final reflections)
- `frontend/dist/` — build artifacts (regenerated)

### Secrets Needed
| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Master agent LLM |
| `GITHUB_TOKEN` | GitHub issue sync |
| `GITHUB_REPO` | Target repo for sync (`owner/repo`) |

## Tech Debt / Known Issues

1. **kanban.css is 3800 lines** — should be split by component
2. **No integration tests** — only unit tests; agent E2E flow is manual
3. **Agent worker spawning** — uses `child_process.fork()`, won't work in serverless
4. **No auth** — the API is fully open, fine for local dev, not for prod
5. **Frontend dist committed** — `frontend/dist/index.html` is in git, should be gitignored
6. **Hardcoded tool icons/labels** — in `ToolChip.jsx`, should be in a config file (#167)

## What Went Well

- **87 iterations in 3 days** — high velocity, each iteration cleanly shipped
- **Agent-first architecture** — MasterChat redesigned to delegate everything to the agent
- **Composable tools** — factory pattern makes tools testable and reusable
- **Soul files** — markdown templates are readable and versionable
- **CI from day 1** — every PR ran tests, build, and lint

## What I'd Do Differently

1. **Split CSS earlier** — 3800 lines in one file made changes risky
2. **Avoid squash-merging uncommitted changes** — PR #173 incident was avoidable
3. **Add integration tests** — a single E2E test hitting the agent endpoint would catch routing bugs
4. **Externalize config sooner** — issue #167 (tool icons, labels, emojis) should have been done first
5. **Use worktrees more consistently** — some PRs were done on main's working tree, which caused staging confusion
