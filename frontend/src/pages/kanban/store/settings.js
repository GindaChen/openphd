// ── Settings store (localStorage-backed) ──

const STORAGE_KEY = 'kanban-settings'

const DEFAULTS = {
    // API / Onboarding
    projectRoot: '',       // absolute path to kanban data dir (empty = server default)
    githubToken: '',
    githubRepo: '',
    llmApiKey: '',
    llmProvider: 'anthropic',
    llmModel: 'claude-sonnet-4-6',
    llmBaseUrl: 'https://api.anthropic.com/v1',

    // Keyboard shortcuts (card navigation)
    shortcuts: {
        openIssue: 'Enter',
        closePanel: 'Escape',
    },

    // Global shortcuts (used with ⌘/Ctrl modifier)
    globalShortcuts: {
        commandPalette: 'k',
        projectChat: 'j',
    },

    // UI prefs
    askPanelOpen: true,
    defaultView: 'board',
    onboardingDone: false,
    kanbanColumnWidth: 280,
    fontSize: 14,
}

export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...DEFAULTS }
        const stored = JSON.parse(raw)
        // Merge with defaults so new keys are always present
        return {
            ...DEFAULTS,
            ...stored,
            shortcuts: { ...DEFAULTS.shortcuts, ...(stored.shortcuts || {}) },
            globalShortcuts: { ...DEFAULTS.globalShortcuts, ...(stored.globalShortcuts || {}) },
        }
    } catch {
        return { ...DEFAULTS }
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (e) {
        console.warn('Failed to save settings:', e)
    }
}

export function getSetting(key) {
    const s = loadSettings()
    return s[key]
}

export function setSetting(key, value) {
    const s = loadSettings()
    s[key] = value
    saveSettings(s)
    return s
}

export { DEFAULTS as SETTING_DEFAULTS }
