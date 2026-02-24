# GitHub Issues Report — GindaChen/openphd

> **Repository:** https://github.com/GindaChen/openphd  
> **Fetched at:** 2026-02-24T19:59:59Z  
> **Total Open Issues:** 1  

---

## Issue #3 — feat: Panel toggle/reorder UX for sidebar

| Field        | Value                                                       |
|--------------|-------------------------------------------------------------|
| **Number**   | #3                                                          |
| **State**    | `open`                                                      |
| **Title**    | feat: Panel toggle/reorder UX for sidebar                   |
| **Author**   | GindaChen                                                   |
| **Created**  | 2026-02-24T19:47:52Z                                        |
| **Updated**  | 2026-02-24T19:47:52Z                                        |
| **Labels**   | `enhancement` (color: #a2eeef) — New feature or request    |
| **Assignees**| _(none)_                                                    |
| **Milestone**| _(none)_                                                    |
| **Comments** | 0                                                           |
| **URL**      | https://github.com/GindaChen/openphd/issues/3              |

### Description

> Add the ability for users to customize the left sidebar:
>
> 1. **Toggle visibility** of each panel item (Home, Kanban, Agents, etc.)
> 2. **Reorder panels** by dragging items up or down
> 3. **"More" button** at the bottom of the sidebar that reveals hidden panels

### Context

> This was discussed as "option B" during the persistent agents implementation (PR #2). The current sidebar has fixed nav items. Power users may want to hide panels they don't use or reorder them.

### Approach Options

- **A (done):** Quick wins shipped — settings moved to sidebar, agents nav added
- **B (this issue):** Add an "Appearance > Sidebar" section in Settings with toggles and drag-to-reorder

### Design Notes

- In Settings > Appearance, add a "Sidebar Items" subsection
- Each item has a toggle (visible/hidden) and a drag handle
- Persist order + visibility in localStorage via `settings.js`
- Consider a "more panels" button at sidebar bottom for hiding overflow

### Related Items

| Type | Reference | Notes |
|------|-----------|-------|
| Pull Request | PR #2 | Referenced in issue body — `feat(agents): persistent agent directories + sidebar UI` (MERGED) |

---

## Context: Merged PRs (for reference)

| PR# | Title | State | URL |
|-----|-------|-------|-----|
| #2 | feat(agents): persistent agent directories + sidebar UI | MERGED | https://github.com/GindaChen/openphd/pull/2 |
| #1 | fix(chat): use full markdown renderer and hide model badge in Ask panel | MERGED | https://github.com/GindaChen/openphd/pull/1 |

---

## Summary for Kanban

| Issue# | Title | Labels | Assignees | Priority Hint |
|--------|-------|--------|-----------|---------------|
| #3 | feat: Panel toggle/reorder UX for sidebar | enhancement | _(unassigned)_ | Medium — UX improvement, backlogged from PR #2 |
