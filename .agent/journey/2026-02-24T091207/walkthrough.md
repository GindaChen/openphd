# Walkthrough: Fix CommandProvider Error & Harden CI

## What Happened

`KanbanInner` called `useRegisterCommands()` → `useCommandPalette()` → threw because `CommandProvider` was **never mounted** in the React tree. CI didn't catch it because `vite build` only bundles — it never renders components.

## Changes Made

### 1. [App.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/App.jsx) — Wrap in CommandProvider

render_diffs(file:///Users/mike/Project/GitHub/openphd/frontend/src/App.jsx)

### 2. [eslint.config.js](file:///Users/mike/Project/GitHub/openphd/frontend/eslint.config.js) — New ESLint config

- `react-hooks/rules-of-hooks` (error) — catches hook rule violations
- `react-hooks/exhaustive-deps` (warn) — catches missing deps
- `no-undef` (error) — catches undefined variables (prior `useNavigate` crash)
- Disabled React 19 strict rules (`set-state-in-effect`, `refs`, `purity`) that flagged existing working patterns

render_diffs(file:///Users/mike/Project/GitHub/openphd/frontend/eslint.config.js)

### 3. [ci.yml](file:///Users/mike/Project/GitHub/openphd/.github/workflows/ci.yml) — Add lint step

render_diffs(file:///Users/mike/Project/GitHub/openphd/.github/workflows/ci.yml)

## Verification

- ✅ `npm run lint` — 0 errors, 22 warnings (unused vars, all `warn` level)
- ✅ `vite build` — builds successfully
- ✅ CI run [#22361888276](https://github.com/GindaChen/openphd/actions/runs/22361888276) — **passed**
