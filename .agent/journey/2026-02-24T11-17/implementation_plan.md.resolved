# Landing Page with YOLO Installation

Create a polished README landing page for `GindaChen/openphd` with a one-liner `curl | bash` install, inspired by ClawRouter's pattern.

## Proposed Changes

### Install Script

#### [NEW] [install.sh](file:///Users/mike/Project/GitHub/openphd/install.sh)

A bootstrap script that handles `git clone`, `npm install` for both backend and frontend, and prints a final "run this to start" message. The script will:

1. Check for prerequisites (`git`, `node` ≥18, `npm`)
2. Clone the repo (or skip if already in the repo directory)
3. `npm install` in `services/kanban/` and `frontend/`
4. Print a success banner with `npm run dev` instructions

The one-liner will be:
```bash
curl -fsSL https://raw.githubusercontent.com/GindaChen/openphd/main/install.sh | bash
```

---

### README

#### [MODIFY] [README.md](file:///Users/mike/Project/GitHub/openphd/README.md)

Rewrite as a landing page with:

1. **Hero section** — project name, one-line tagline, YOLO install command front-and-center
2. **What is this?** — brief description of the AI-native research Kanban
3. **Features** — agent chat, GitHub sync, command palette
4. **Manual Install** — step-by-step for people who don't trust `curl | bash`
5. **Configuration** — env vars for Anthropic API key, GitHub token
6. **Architecture** — quick overview of frontend/backend structure
7. **Testing** — existing test commands

## Verification Plan

### Manual Verification
1. Run `bash install.sh` in a temp directory to verify it clones and installs successfully
2. Visually review the README on GitHub (or `cat README.md`) to confirm formatting and accuracy
