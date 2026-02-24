# Fix `useCommandPalette must be used within CommandProvider` & Harden CI

## Root Cause

`KanbanInner` (line 180) calls `useRegisterCommands('kanban', …)` which internally calls `useCommandPalette()`. This hook throws if `CommandContext` is `null` — meaning no `<CommandProvider>` exists above it in the React tree.

The component tree today is:

```
main.jsx → App → KanbanPage → KanbanProvider → KanbanInner ← 💥 no CommandProvider
```

`CommandProvider` was created in `CommandContext.jsx` but **never mounted anywhere**.

### Why CI doesn't catch it

CI runs only `npx vite build`, which is a **static bundler** — it tree-shakes and compiles JSX but never renders components. Runtime errors like missing context providers are invisible to it. There's also no `npm run lint` step in CI, and no `eslint.config.js` exists.

> [!NOTE]
> ESLint alone won't catch this specific error either (missing context providers are a runtime concern, not a static analysis one). But adding ESLint to CI catches many other classes of errors — unused imports, undefined variables, hook rule violations — that `vite build` silently ignores. ESLint would have caught the `useNavigate` crash from a prior incident.

---

## Proposed Changes

### Frontend App Shell

#### [MODIFY] [App.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/App.jsx)

Wrap `<KanbanPage />` with `<CommandProvider>` so the context is available to all pages:

```diff
 import KanbanPage from './pages/kanban/KanbanPage'
+import { CommandProvider } from './contexts/CommandContext'
+import { useState, useCallback } from 'react'
+import CommandPalette from './pages/kanban/components/palette/CommandPalette'

 export default function App() {
-    return <KanbanPage />
+    const [theme, setTheme] = useState(() =>
+        localStorage.getItem('kb-theme') || 'dark'
+    )
+    const toggleTheme = useCallback(() => {
+        setTheme(t => { const next = t === 'dark' ? 'light' : 'dark'; localStorage.setItem('kb-theme', next); return next })
+    }, [])
+
+    return (
+        <CommandProvider theme={theme} toggleTheme={toggleTheme}>
+            <KanbanPage />
+            <CommandPalette />
+        </CommandProvider>
+    )
 }
```

> [!IMPORTANT]
> `CommandProvider` requires `theme` and `toggleTheme` props. These are currently not managed anywhere in the app — we need to add minimal theme state in `App`. If theme state lives elsewhere (e.g. in KanbanInner or a CSS-only approach), we can simplify. I'll check during execution.

---

### CI Pipeline

#### [NEW] [eslint.config.js](file:///Users/mike/Project/GitHub/openphd/frontend/eslint.config.js)

Create a flat-config ESLint setup (ESLint 10 is already installed):

- `eslint-plugin-react-hooks` for hook rules
- Standard JS recommended rules
- React JSX runtime settings

#### [MODIFY] [ci.yml](file:///Users/mike/Project/GitHub/openphd/.github/workflows/ci.yml)

Add `npm run lint` before `vite build`:

```diff
       - name: Frontend build
-        run: cd frontend && npm ci --legacy-peer-deps && npx vite build
+        run: |
+          cd frontend && npm ci --legacy-peer-deps
+          npm run lint
+          npx vite build
```

---

## Verification Plan

### Automated Tests

1. **ESLint** — `cd frontend && npm run lint` must pass with zero errors
2. **Vite build** — `cd frontend && npx vite build` must succeed
3. **CI pipeline** — push changes and verify CI passes

### Why this is sufficient

The runtime error was caused by a missing provider — once `CommandProvider` wraps the app, the hook will find its context. ESLint in CI will catch future static errors (undefined vars, hook violations, etc.). For the structural provider issue class, we rely on the existing `vite build` + any future component tests.
