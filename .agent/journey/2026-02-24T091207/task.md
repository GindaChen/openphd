# Fix CommandProvider Error & Harden CI

## Bug Fix
- [x] Wrap `KanbanInner` in `CommandProvider` so `useRegisterCommands` has context
- [x] Verify the fix doesn't regress (theme/toggle integration)

## CI Hardening
- [x] Create `eslint.config.js` for the frontend (flat config, ESLint 10)
- [x] Add ESLint `npm run lint` step to CI workflow before `vite build`
- [x] Verify CI catches this class of error

## Cleanup
- [ ] Copy artifacts to `.agent/journey/` folder
