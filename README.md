<div align="center">

# 🎓 OpenPhD

**AI-native research management — a Kanban board with agent-powered orchestration.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)

</div>

---

## ⚡ One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/GindaChen/openphd/main/install.sh | bash
```

That's it. This clones the repo, installs dependencies, and prints instructions to start.

> **Already cloned?** Run it manually:
> ```bash
> cd frontend && npm install && cd ../services/kanban && npm install
> cd ../../frontend && npm run dev
> ```

---

## 🚀 What is OpenPhD?

OpenPhD is a research management tool built for PhD students and researchers. It combines a **Kanban board** for tracking research tasks with an **AI agent** that can create issues, plan work, and sync with GitHub — all from a single chat interface.

### ✨ Features

| Feature | Description |
|---------|-------------|
| 📋 **Kanban Board** | Drag-and-drop issue tracking with labels, priorities, and multiple columns |
| 🤖 **AI Agent** | Natural language task creation, planning, and issue management |
| 🔗 **GitHub Sync** | Bidirectional sync — issues flow between your board and GitHub |
| ⌨️ **Command Palette** | `Cmd+K` for instant access to any action |
| 💬 **Chat Panel** | `Cmd+J` to ask the agent questions inline |
| 🌙 **Dark Mode** | Easy on the eyes during late-night research |

---

## 🏃 Quick Start

### 1. Start the app

```bash
cd openphd/frontend
npm run dev
```

Open **http://localhost:5173** — you're ready to go.

### 2. Enable the AI Agent *(optional)*

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

Or configure it from the **Settings** panel in the UI.

### 3. Enable GitHub Sync *(optional)*

```bash
GITHUB_TOKEN=ghp_... GITHUB_REPO=owner/repo npm run dev
```

Or configure it from the **Settings** panel in the UI.

---

## 🏗 Architecture

```
openphd/
├── frontend/             React + Vite SPA
│   └── src/pages/kanban/   Kanban board UI, command palette, chat
├── services/kanban/      Express API server
│   ├── lib/              Agent engine, tools, souls
│   ├── routes/           REST + SSE endpoints
│   └── tests/            Test suite
└── .agent/               Agent workflows & memory
```

| Layer | Stack |
|-------|-------|
| Frontend | React 19, Vite 7 |
| Backend | Express 5, Node.js |
| AI | Anthropic Claude (via pi-agent-core) |
| Data | File-based JSON (zero-config) |

---

## 🧪 Testing

```bash
# Backend tests
cd services/kanban && node --test tests/*.js

# Frontend lint + build
cd frontend && npm run lint && npm run build
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'Add my feature'`)
4. Push and open a PR

---

## 📄 License

MIT © [GindaChen](https://github.com/GindaChen)
