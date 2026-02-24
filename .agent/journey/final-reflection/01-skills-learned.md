# Skills Learned — Execution Playbook

Patterns and rules extracted from 87 iterations across 3 days on the sandbox-whisper-transcriber project. These are the execution patterns that every agent journey should internalize.

---

## 1. The PR Pipeline

Every code change follows: **branch → commit → push → PR → CI → merge**. Never commit directly to main.

| Step | Command | Gotcha |
|------|---------|--------|
| Branch | `git checkout -b feat/name` | Always branch from latest main |
| Commit | `git commit -m 'type(scope): msg'` | Use single quotes for commit messages in zsh to avoid shell expansion |
| Push | `git push -u origin branch` | First push needs `-u` |
| PR | `gh pr create --title ... --body ... --base main` | Include testing evidence in body |
| CI | `gh pr checks N` → poll until green | Sleep 120s minimum before first poll |
| Merge | `gh pr merge N --squash --delete-branch --admin` | Always use `--squash` for clean history |

**Lesson learned**: Shell escaping matters. Commit messages with special characters (`—`, backticks, `#`) must use single quotes, not double quotes. One failed commit can break the flow.

## 2. Test-First Verification

Run tests **before** committing, not after. The pattern:

```
1. Make change
2. Run existing tests → all pass?
3. Write new tests for the change
4. Run all tests together
5. Build frontend (npx vite build)
6. Only then: commit → push → PR
```

**Key numbers to track**: always state "X tests pass, 0 fail" in the PR body. The test count grew: 20 → 43 → 51 → 61 across this project.

## 3. Squash Merge Traps

Squash merging creates a new commit on main. The original branch commits aren't in main's linear history. This means:

- `git diff main...branch --name-only` shows files even when the content is identical
- `git diff main..branch --shortstat` tells the real story (0 insertions = already merged)
- Always use `--shortstat` to check if a branch is truly stale
- Uncommitted working tree changes can get pulled into a squash merge — be very careful about what's staged

**Lesson learned (PR #173)**: A squash merge of an unrelated PR accidentally absorbed uncommitted working tree changes, making a feature PR's content appear already on main.

## 4. API Pagination

Any external API that returns lists (GitHub Issues, labels, etc.) needs pagination. The pattern:

```javascript
const all = []
let page = 1
while (true) {
    const items = await api(`?per_page=100&page=${page}`)
    all.push(...items)
    if (items.length < 100) break
    page++
}
```

**Lesson learned (DistCA)**: GitHub's Issues API mixes PRs with issues. A repo with 96 PRs + 4 issues returns only 4 real issues on page 1. Without pagination, issues #101+ are invisible.

## 5. Component Extraction

When a file exceeds ~300 lines, extract sub-components:

1. Identify self-contained UI pieces (ToolChip, PromptDebug)
2. Move to own file with same naming convention
3. Update imports in parent
4. Verify build still passes

**MasterChat**: 545 → 321 lines (+ 50 + 45 in extracted files). Removed 3 message handlers, 2 SSE parsers, and 60 lines of regex commands.

## 6. Agent Architecture Patterns

### Soul Files
- Markdown templates with `{{variable}}` interpolation
- Stored in `lib/souls/` directory
- Loaded by `loadSoul(name, vars)` function
- Project-level overrides possible in `.agents/souls/`

### Tool Composition
- Tools are organized by category: kanban/, orchestration/, coding/, communication/
- Each tool is an `AgentTool` factory function receiving a context object
- Composer functions (`createMasterTools`, `createKanbanTools`) assemble the right tools for each agent type
- Context injection (e.g., `dataDir`) replaces req-based dependencies

### Agent Hierarchy
```
Project Master → Workspace Agent(s) → Worker(s)
```
- Project Master: always-on, 1 per session, has kanban + orchestration tools
- Workspace Agent: scoped to a workspace, has orchestration + coding + communication tools
- Worker: single-task, has communication + coding tools

## 7. CSS Class Naming

Convention: `kb-` prefix for all kanban CSS classes.
```
kb-{component}-{element}--{modifier}
```
Examples: `kb-ask-panel--open`, `kb-ask-msg--streaming`, `kb-ask-tool-chip--error`

## 8. CI Configuration

Keep test commands explicit in `deploy.yml`:
```yaml
node --test tests/test_a.js tests/test_b.js tests/test_c.js
```
DON'T use glob patterns — they may not match in all CI environments. Add each new test file explicitly.
