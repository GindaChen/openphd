import { createContext, useContext, useReducer, useEffect } from 'react'
import { apiFetch } from './api'

// ── Reducer ──

function kanbanReducer(state, action) {
    switch (action.type) {
        case 'SET_BOARD':
            return { ...state, board: action.board, loading: false }
        case 'SET_ISSUES':
            return { ...state, issues: action.issues, loading: false }
        case 'SET_LOADING':
            return { ...state, loading: true }
        case 'UPSERT_ISSUE': {
            const exists = state.issues.find(i => i.id === action.issue.id)
            return {
                ...state,
                issues: exists
                    ? state.issues.map(i => i.id === action.issue.id ? action.issue : i)
                    : [...state.issues, action.issue],
            }
        }
        case 'REMOVE_ISSUE':
            return { ...state, issues: state.issues.filter(i => i.id !== action.id) }
        case 'ADD_MASTER_CHAT':
            return {
                ...state,
                masterChat: [...state.masterChat, {
                    role: action.role,
                    content: action.content,
                    timestamp: new Date().toISOString(),
                    ...(action.toolCalls ? { toolCalls: action.toolCalls } : {}),
                    ...(action.debugInfo ? { debugInfo: action.debugInfo } : {}),
                }],
            }
        case 'SET_MASTER_CHAT':
            return { ...state, masterChat: action.messages }
        default:
            return state
    }
}

// ── Initial master chat — starts empty ──
const INITIAL_MASTER_CHAT = []

// ── Context ──
const KanbanContext = createContext(null)

export function KanbanProvider({ children }) {
    const [state, dispatch] = useReducer(kanbanReducer, {
        board: null,
        issues: [],
        masterChat: INITIAL_MASTER_CHAT,
        loading: true,
    })

    useEffect(() => {
        async function load() {
            try {
                dispatch({ type: 'SET_LOADING' })
                const [board, issues] = await Promise.all([
                    apiFetch('/board'),
                    apiFetch('/issues'),
                ])
                dispatch({ type: 'SET_BOARD', board })
                dispatch({ type: 'SET_ISSUES', issues })
            } catch (err) {
                console.error('Failed to load kanban data:', err)
                dispatch({ type: 'SET_BOARD', board: null })
                dispatch({ type: 'SET_ISSUES', issues: [] })
            }
        }
        load()
    }, [])

    // Load chat history from backend on mount
    useEffect(() => {
        apiFetch('/chat/history')
            .then(messages => {
                if (Array.isArray(messages) && messages.length > 0) {
                    dispatch({ type: 'SET_MASTER_CHAT', messages })
                }
            })
            .catch(() => { /* history not available yet */ })
    }, [])

    const actions = {
        async loadBoard() {
            dispatch({ type: 'SET_LOADING' })
            const [board, issues] = await Promise.all([
                apiFetch('/board'),
                apiFetch('/issues'),
            ])
            dispatch({ type: 'SET_BOARD', board })
            dispatch({ type: 'SET_ISSUES', issues })
        },

        async createIssue(title, opts = {}) {
            const issue = await apiFetch('/issues', {
                method: 'POST',
                body: JSON.stringify({ title, ...opts }),
            })
            dispatch({ type: 'UPSERT_ISSUE', issue })
            return issue
        },

        async moveIssue(id, newStatus) {
            const issue = await apiFetch(`/issues/${id}/move`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            })
            dispatch({ type: 'UPSERT_ISSUE', issue })
            return issue
        },

        async updateIssue(id, updates) {
            const issue = await apiFetch(`/issues/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
            })
            dispatch({ type: 'UPSERT_ISSUE', issue })
            return issue
        },

        async addIssueChat(id, role, content) {
            const issue = await apiFetch(`/issues/${id}/chat`, {
                method: 'POST',
                body: JSON.stringify({ role, content }),
            })
            dispatch({ type: 'UPSERT_ISSUE', issue })
            return issue
        },

        async deleteIssue(id) {
            await apiFetch(`/issues/${id}`, { method: 'DELETE' })
            dispatch({ type: 'REMOVE_ISSUE', id })
        },

        addMasterChat(role, content, toolCalls, debugInfo) {
            dispatch({ type: 'ADD_MASTER_CHAT', role, content, toolCalls, debugInfo })
            // Persist to backend (fire and forget) — don't persist debug info
            apiFetch('/chat/history', {
                method: 'POST',
                body: JSON.stringify({ role, content, ...(toolCalls ? { toolCalls } : {}) }),
            }).catch(() => { })
        },

        async loadChatHistory() {
            try {
                const messages = await apiFetch('/chat/history')
                if (Array.isArray(messages)) {
                    dispatch({ type: 'SET_MASTER_CHAT', messages })
                }
            } catch { /* ignore */ }
        },

        async clearChatHistory() {
            dispatch({ type: 'SET_MASTER_CHAT', messages: [] })
            await apiFetch('/chat/history', { method: 'DELETE' }).catch(() => { })
        },
    }

    return (
        <KanbanContext.Provider value={{ state, dispatch, actions }}>
            {children}
        </KanbanContext.Provider>
    )
}

export function useKanban() {
    const ctx = useContext(KanbanContext)
    if (!ctx) throw new Error('useKanban must be inside KanbanProvider')
    return ctx
}

// ── Default board config ──
export const COLUMNS = [
    { id: 'backlog', label: 'Backlog', emoji: '📋', description: 'Not yet started' },
    { id: 'ideation', label: 'Ideation', emoji: '💡', description: 'Still a drafting idea' },
    { id: 'in-progress', label: 'In Progress', emoji: '🔨', description: 'Actively being worked on' },
    { id: 'blocked', label: 'Blocked', emoji: '🚫', description: 'Needs help from human' },
    { id: 'review', label: 'Review', emoji: '👀', description: 'This item is in review' },
    { id: 'done', label: 'Done', emoji: '✅', description: 'This has been completed' },
]

// ── Default label colors (fallback when board.json has no entry) ──
// Auto-generate from a hue palette based on label name hash
function hashCode(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash)
}

export function getLabelColor(label, boardLabels = {}) {
    if (boardLabels[label]) return boardLabels[label]
    // Generate a deterministic color from the label name
    const hue = hashCode(label) % 360
    return {
        bg: `hsla(${hue}, 50%, 25%, 0.35)`,
        text: `hsl(${hue}, 80%, 75%)`,
    }
}

// Legacy export for backwards compat
export const LABEL_COLORS = new Proxy({}, {
    get(_, key) {
        if (typeof key === 'symbol') return undefined
        return getLabelColor(key)
    },
    has() { return true },
})

