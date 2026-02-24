# Theme Toggle Fix

## Bug
When loading the app, `data-theme` was never set on `<html>`, so CSS defaulted to light (`:root` vars). But React state read `'dark'` from localStorage, causing the Command+K label to say "Switch to Light Mode" while already in light mode. Clicking toggled state to `'light'` → still light visually.

## Fix
Added `useEffect` in `App.jsx` to sync `data-theme` on mount and on every theme change.

## Verification
- ✅ `vite build` passes
- ✅ 61/61 backend tests pass
