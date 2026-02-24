---
description: Onboard to the openphd codebase — read architecture, understand patterns, then execute tasks
---

// turbo-all

## Steps

1. Read the repo architecture overview:
   ```bash
   cat .agent/workflows/repo-overview.md
   ```

2. Read the feature development workflow:
   ```bash
   cat .agent/workflows/feature-dev.md
   ```

3. Read the execution agent soul (identity + principles):
   ```bash
   cat .agent/journey/final-reflection/02-execution-agent-soul.md
   ```

4. Read the skills and patterns learned:
   ```bash
   cat .agent/journey/final-reflection/01-skills-learned.md
   ```

5. Verify the environment works:
   ```bash
   cd services/kanban && node --test tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js
   ```

6. You are now onboarded. Ask the user what task they'd like you to work on, or proceed with the task they already gave you. Follow the `/feature-dev` workflow for any code changes.
