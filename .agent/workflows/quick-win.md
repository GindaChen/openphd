---
description: Ship a visible demo fast — code + UI — with checkpointed TODOs as issues
---

// turbo-all

## Philosophy

Move fast. Show something working. Checkpoint quality improvements as issues. Don't sacrifice correctness, but defer polish.

## Steps

1. Read the request. Identify the smallest shippable slice.
2. Skip detailed planning artifacts — go straight to code:
   ```
   UNDERSTAND (2 min) → CODE (bulk of time) → TEST → SHIP
   ```
3. Write code changes directly. Run tests after each file.
4. If you notice something that needs refactoring but isn't blocking:
   - Add a `// TODO(quick-win): ...` comment in code
   - Note it for a follow-up issue
5. Run backend tests:
   ```bash
   cd services/kanban && node --test tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js
   ```
6. Build frontend:
   ```bash
   cd frontend && npx vite build
   ```
7. If not instructed by user, do not create a branch, and just work in local. If user tells you to create branch or another worktree, + commit + PR (follow `/feature-dev` steps 6-13)
8. After merging, create GitHub issues for any deferred TODOs
