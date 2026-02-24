# Research Kanban Board

A file-based kanban board for managing research issues, built with React + Express.

## Quick Start

```bash
cd frontend
npm install
npm run dev
# → opens http://localhost:5173/kanban
```

This starts both the **Express API** (port 3001) and **Vite dev server** (port 5173) via `concurrently`.

## Architecture

```
pages/kanban/
├── KanbanPage.jsx              ← Root layout
├── kanban.css                  ← All styles
├── store/
│   ├── kanbanData.jsx          ← React Context + reducer + actions
│   └── api.js                  ← Fetch helpers → /api/kanban/*
├── components/
│   ├── board/                  ← KanbanBoard, IssueCard
│   ├── detail/                 ← IssueDetailPanel + sub-components
│   │   ├── IssueBody.jsx       ← Markdown body renderer
│   │   ├── ArtifactList.jsx
│   │   ├── RelationshipList.jsx
│   │   ├── IssueChat.jsx
│   │   ├── IssueSidebar.jsx
│   │   └── WorkspacePanel.jsx  ← Agent chat sessions per issue
│   ├── chat/MasterChat.jsx     ← Global "Ask" command panel
│   └── sidebar/ProjectSidebar  ← Left project icon strip
├── hooks/useResizable.js       ← Drag-to-resize panel
└── lib/markdown.js             ← Lightweight MD→HTML (force-tracked, see .gitignore)
```

## Data Storage

All data lives in `data/kanban/` (git-tracked, diffable):

| File | Purpose |
|------|---------|
| `board.json` | Column definitions, labels, priorities |
| `.meta.json` | ID counter, sync metadata |
| `issues/N.json` | Issue metadata (status, labels, artifacts, workspaces) |
| `issues/N.md` | Issue body in Markdown |

## API Endpoints

All routes are proxied through Vite: `localhost:5173/api/kanban/*` → `localhost:3001/kanban/*`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/kanban/board` | Board config |
| GET | `/api/kanban/issues` | All issues |
| GET | `/api/kanban/issues/:id` | Single issue |
| POST | `/api/kanban/issues` | Create issue |
| PATCH | `/api/kanban/issues/:id` | Update issue |
| PATCH | `/api/kanban/issues/:id/move` | Change status |
| POST | `/api/kanban/issues/:id/chat` | Add chat message |
| DELETE | `/api/kanban/issues/:id` | Delete issue |

## Features

- **6-column board**: Backlog → Ideation → In Progress → Blocked → Review → Done
- **Resizable detail panel**: drag left edge, width saved to localStorage
- **Markdown rendering**: headings, tables, code blocks, task lists
- **Workspaces**: per-issue agent chat sessions (add/delete/chat)
- **Ask panel**: command-driven sidebar (`create issue`, `move #N to`, `summary`, etc.)
- **Project sidebar**: switch between projects

## ⚠️ Note on `lib/`

The root `.gitignore` has a `lib/` rule. The `lib/markdown.js` file is **force-tracked** with `git add -f`. If you add new files under `lib/`, remember to force-add them.
