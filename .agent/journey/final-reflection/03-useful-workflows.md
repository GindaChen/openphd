# Workflows That Work

Useful, battle-tested workflows from this project, in the format they can be directly used as `.agent/workflows/` files.

---

## 1. Feature Development (End-to-End)

**When**: Adding a new feature or fixing a bug.

```
1. Understand the request — read relevant files, check existing patterns
2. Write a brief plan (only if multi-file; skip for small changes)
3. Make the changes
4. Run existing tests → confirm count and all pass
5. Write new tests for the change → confirm they pass
6. Build frontend: cd frontend && npx vite build
7. Create branch: git checkout -b feat/descriptive-name
8. Stage only relevant files: git add file1 file2
9. Commit with conventional prefix: git commit -m 'type(scope): msg'
10. Push: git push -u origin feat/descriptive-name
11. Create PR: gh pr create --title '...' --body '...' --base main
12. Poll CI: sleep 120 && gh pr checks N
13. If CI fails: fix → commit → push → repeat step 12
14. Merge: gh pr merge N --squash --delete-branch --admin
```

## 2. CI Babysit Loop

**When**: Waiting for CI to pass after pushing.

```
1. Push the fix: git push
2. Wait for CI to spin up: sleep 120
3. Check: gh pr checks PR_NUMBER
4. If pending: sleep 60 → repeat step 3
5. If failed: read the failure, fix, commit, push → go to step 2
6. If passed: merge
```

**Key timing**: First poll at 120s, subsequent at 60s. GitHub Actions typically start within 30-60s.

## 3. Branch Cleanup Audit

**When**: Periodically, or before repo migration.

```
1. Fetch and prune: git fetch --prune origin
2. List remote branches: git branch -r | grep -v main | grep -v HEAD
3. Check for open PRs: gh pr list --state open
4. For branches with no open PRs, check if content is on main:
   git diff origin/main..origin/BRANCH --shortstat
5. If 0 changes: safe to delete
6. If changes exist but PR was squash-merged: also safe (squash creates new commit)
7. Bulk delete: for b in ...; do git push origin --delete $b; done
```

## 4. Component Extraction Refactor

**When**: A file exceeds ~300-400 lines with identifiable sub-components.

```
1. Identify self-contained pieces (look for internal components, helper functions)
2. For each extraction:
   a. Create new file with same naming convention
   b. Move component + its helpers/constants
   c. Add proper imports/exports
3. Update parent file — remove extracted code, add import
4. Build and test to verify nothing broke
5. Check line counts: document before/after
```

## 5. GitHub Sync Debug

**When**: Issues aren't syncing from GitHub as expected.

```
1. Check what the API actually returns:
   gh api '/repos/OWNER/REPO/issues?state=all&per_page=100' --jq '.[] | {number, title, state, is_pr: (.pull_request != null)}'
2. Count real issues vs PRs:
   gh api ... --jq '[.[] | select(.pull_request == null)] | length'
3. Check pagination — does the repo have > 100 items?
   gh api ... --jq 'length'
4. Verify sync code handles:
   - Pagination (all pages)
   - PR filtering (pull_request field)
   - State mapping (open→backlog, closed→done)
```

## 6. Agent Integration Testing

**When**: Testing the pi-mono agent integration in the UI.

```
1. Start backend with API key:
   ANTHROPIC_API_KEY=sk-ant-... node services/kanban/server.js
2. Start frontend:
   cd frontend && npm run dev
3. Verify agent badge shows in chat header
4. Test tool calls: "create issue Test issue" → should see ToolChip
5. Test board integration: issue should appear on board
6. Test debug mode: toggle 🔎 → should show prompt context
7. Test fallback: restart server without API key → should show onboarding
```

## 7. Soul File Creation

**When**: Adding a new agent type.

```
1. Create soul markdown in services/kanban/lib/souls/
2. Use {{variable}} for interpolation (agentId, workspace, issues, etc.)
3. Structure:
   - Identity section (who are you, your ID, your role)
   - Capabilities section (what tools you have)
   - Workflow section (step-by-step how to approach tasks)
   - Rules section (constraints and boundaries)
4. Register agent factory in agent-engine.js
5. Add soul loading: loadSoul('soul-name', { agentId, ... })
6. Test with unit test verifying soul loads and variables interpolate
```
