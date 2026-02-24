---
description: Push a fix, wait for CI to spin up, poll status, and loop until CI is green
---

// turbo-all

## Steps

1. Push the fix:
   ```bash
   git push
   ```
2. Wait for CI to spin up:
   ```bash
   sleep 120
   ```
3. Check CI status:
   ```bash
   gh pr checks PR_NUMBER
   ```
4. If checks are pending, wait and retry:
   ```bash
   sleep 60 && gh pr checks PR_NUMBER
   ```
5. If checks fail: read the failure log, fix the issue, commit and push, then go back to step 2
6. If all checks pass: merge:
   ```bash
   gh pr merge PR_NUMBER --squash --delete-branch --admin
   ```
