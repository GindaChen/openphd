# Fix Onboarding File Browser — Click to Select Directory

Clicking a directory in the onboarding file browser currently navigates *into* that directory instead of selecting it. The user expects a single click to select a directory as the project root.

## Root Cause

In [OnboardingWizard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/onboarding/OnboardingWizard.jsx#L176-L180), each directory item's `onClick` calls `handleBrowse(d)`, which fetches and displays the *contents* of that directory. There's no way to "select" a directory — only navigate into it. The "✓ Use this directory" button selects the *current parent* (`browsePath`), but it often scrolls out of view.

## Proposed Changes

### Onboarding Component

#### [MODIFY] [OnboardingWizard.jsx](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/components/onboarding/OnboardingWizard.jsx)

**Interaction redesign:**
- **Single click** on a directory → selects it (sets `projectRoot` to that path, highlights the item)
- **Double click** on a directory → navigates into it (current `handleBrowse` behavior)
- Add a `selectedDir` state to track which directory is highlighted
- Update the "✓ Use this directory" button to use `selectedDir` if one is selected, otherwise fall back to `browsePath`
- Clicking `..` still navigates up (single click)

**Visual feedback:**
- Add an `.active` class to the selected directory item for clear visual distinction

### Styles

#### [MODIFY] [kanban.css](file:///Users/mike/Project/GitHub/openphd/frontend/src/pages/kanban/kanban.css)

- Add `.onboarding-browser-item.active` style (highlight background + accent border-left) so the selected directory is visually obvious
- Add a subtle hint text below the browser list: "Click to select · Double-click to open"

## Verification Plan

### Manual Verification
1. Run `npm run dev` in `frontend/`
2. Clear `localStorage` to trigger onboarding (or set `onboardingDone: false`)
3. Navigate to the **Project** step
4. Click **Browse** to open the file browser
5. **Single-click** a directory → it should highlight and the input should update with its path
6. **Double-click** a directory → it should navigate into that directory
7. Click **Next →** → the selected directory should be saved as `projectRoot`
