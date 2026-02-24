# Fix Ask Panel Markdown Rendering & Hide Model Badge

Two issues in the Ask panel:
1. **Markdown not rendered properly** — `MasterChat.jsx` imports from `utils/renderMarkdown.js` (basic: bold, italic, inline code, lists, code blocks). The full renderer at `lib/markdown.js` supports headings, tables, task lists, paragraphs, ordered lists, and horizontal rules. The chat panel also lacks CSS for headings/tables within `.kb-ask-msg-text`.
2. **Model badge visible** — Line 186 displays `agentStatus?.model || settings.llmModel` (e.g. "moonshotai/Kimi-K2.5") in `.kb-ask-llm-badge`. User wants it hidden.

## Proposed Changes

### Chat Component

#### [MODIFY] [MasterChat.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/chat/MasterChat.jsx)

- **Line 5**: Change import from `../../utils/renderMarkdown` → `../../lib/markdown`
- **Lines 185-187**: Remove the `badge` variable and the `<span className="kb-ask-llm-badge">` element entirely

---

### Styles

#### [MODIFY] [kanban.css](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/kanban.css)

- Add heading styles (`h1`-`h4`), table styles, code block styles, paragraph spacing, and horizontal rules scoped under `.kb-ask-msg-text` so the full markdown renderer's HTML is styled correctly

## Verification Plan

### Automated Tests
```bash
cd services/kanban && node --test tests/test_project.js tests/test_chat.js tests/test_agent_mailbox.js tests/test_admin_tools.js tests/test_kanban_tools.js tests/test_github_sync.js
```

### Build
```bash
cd frontend && npx vite build
```

### Manual Verification
Open the app in a browser, send a message like "hi" to the agent, confirm:
1. The model badge no longer appears in the header
2. Agent responses with `## headings`, `**bold**`, bullet lists, etc. render correctly
