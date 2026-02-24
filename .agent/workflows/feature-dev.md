---
description: Plan, implement, and verify a feature change with a PR
---

// turbo-all

## Steps

1. Understand the request — read relevant files, check existing patterns
2. Make the code changes
3. Run backend tests:
   ```bash
   cd services/kanban && node --test tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js
   ```
4. Build frontend:
   ```bash
   cd frontend && npx vite build
   ```
5. Write new tests if you added new logic
6. Create a branch:
   ```bash
   git checkout -b feat/descriptive-name
   ```
7. Stage relevant files:
   ```bash
   git add file1 file2
   ```
8. Commit with conventional prefix:
   ```bash
   git commit -m 'type(scope): description'
   ```
9. Push:
   ```bash
   git push -u origin feat/descriptive-name
   ```
10. Create PR:
    ```bash
    gh pr create --title '...' --body '...' --base main
    ```
11. Poll CI:
    ```bash
    sleep 120 && gh pr checks PR_NUMBER
    ```
12. If CI fails: fix → commit → push → repeat step 11
13. Merge:
    ```bash
    gh pr merge PR_NUMBER --squash --delete-branch --admin
    ```
