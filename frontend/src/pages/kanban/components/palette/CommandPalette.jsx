import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useKanban } from '../../store/kanbanData'
import { useCommandPalette } from '../../../../contexts/CommandContext'

/**
 * CommandPalette — Raycast/Spotlight-style overlay scoped to the kanban sub-app.
 * ⌘K to open. Shows issues, artifacts, views, and actions.
 */
export default function CommandPalette({ isOpen, onClose }) {
    const [query, setQuery] = useState('')
    const [selectedIdx, setSelectedIdx] = useState(0)
    const inputRef = useRef(null)
    const { state } = useKanban()
    const { allCommands } = useCommandPalette()

    useEffect(() => {
        if (isOpen) {
            setQuery('')
            setSelectedIdx(0)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    // Build actions from kanban state
    const actions = useMemo(() => {
        const items = []

        // Issues
        for (const issue of (state.issues || [])) {
            const statusEmoji = { backlog: '📥', 'in-progress': '🔄', blocked: '🚧', done: '✅', ideation: '💡' }
            items.push({
                id: `issue:${issue.id}`,
                type: 'issue',
                icon: statusEmoji[issue.status] || '📋',
                label: `#${issue.id} ${issue.title}`,
                subtitle: `${issue.status} · ${(issue.labels || []).join(', ') || 'no labels'}`,
                action: () => dispatch({ selectIssue: issue.id }),
            })

            // Artifacts inside this issue
            if (issue.artifacts?.length) {
                for (const artifact of issue.artifacts) {
                    items.push({
                        id: `artifact:${issue.id}:${artifact.name || artifact}`,
                        type: 'artifact',
                        icon: '🗂️',
                        label: typeof artifact === 'string' ? artifact : artifact.name,
                        subtitle: `Artifact in #${issue.id} ${issue.title}`,
                        action: () => dispatch({ selectIssue: issue.id, expandSection: 'Artifacts' }),
                    })
                }
            }

            // Workspaces inside this issue
            if (issue.workspaces?.length) {
                for (const ws of issue.workspaces) {
                    items.push({
                        id: `workspace:${issue.id}:${ws.id}`,
                        type: 'workspace',
                        icon: '🔀',
                        label: ws.name,
                        subtitle: `Workspace in #${issue.id} ${issue.title}`,
                        action: () => dispatch({ selectIssue: issue.id, expandSection: 'Workspaces' }),
                    })
                }
            }
        }

        // Actions
        items.push(
            { id: 'cmd:create-issue', type: 'action', icon: '✨', label: 'Create Issue', subtitle: 'Create a new issue (dialog)', action: () => dispatch({ createIssue: true }) },
        )

        // Views
        items.push(
            { id: 'cmd:board', type: 'view', icon: '📋', label: 'Board View', subtitle: 'Switch to kanban board', action: () => dispatch({ view: 'board' }) },
            { id: 'cmd:team', type: 'view', icon: '👥', label: 'Team Items', subtitle: 'Switch to team items view', action: () => dispatch({ view: 'team' }) },
            { id: 'cmd:roadmap', type: 'view', icon: '🗺️', label: 'Roadmap', subtitle: 'Switch to timeline view', action: () => dispatch({ view: 'timeline' }) },
            { id: 'cmd:chat', type: 'view', icon: '💬', label: 'Project Chat', subtitle: 'Open project-level chat (⌘J)', action: () => dispatch({ view: 'chat' }) },
            { id: 'cmd:settings', type: 'action', icon: '⚙️', label: 'Settings', subtitle: 'Open settings panel', action: () => dispatch({ view: 'settings' }) },
        )

        return items
    }, [state.issues])

    // Merge local actions with global commands from CommandContext (theme toggle, etc.)
    const allActions = useMemo(() => {
        // Global commands already have id, icon, label, subtitle, action
        const globalCmds = allCommands.filter(c => !actions.find(a => a.id === c.id))
        return [...actions, ...globalCmds]
    }, [actions, allCommands])

    const filtered = query.trim()
        ? allActions.filter(a => {
            const q = query.toLowerCase()
            return a.label.toLowerCase().includes(q) ||
                (a.subtitle || '').toLowerCase().includes(q)
        })
        : allActions

    useEffect(() => { setSelectedIdx(0) }, [query])

    const handleSelect = useCallback((action) => {
        onClose()
        action.action()
    }, [onClose])

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { onClose(); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
        if (e.key === 'Enter' && filtered[selectedIdx]) {
            e.preventDefault()
            handleSelect(filtered[selectedIdx])
        } else if (e.key === 'Enter' && filtered.length === 0 && query.trim()) {
            // No matching command — send to Master Agent
            e.preventDefault()
            onClose()
            dispatch({ agentMessage: query.trim() })
        }
    }

    if (!isOpen) return null

    return (
        <div className="kb-palette-overlay" onClick={onClose}>
            <div className="kb-palette" onClick={e => e.stopPropagation()}>
                <div className="kb-palette-input-row">
                    <span className="kb-palette-search-icon">🔍</span>
                    <input
                        ref={inputRef}
                        className="kb-palette-input"
                        placeholder="Search issues, artifacts, commands..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <kbd className="kb-palette-kbd">esc</kbd>
                </div>
                <div className="kb-palette-results">
                    {filtered.length === 0 && query.trim() && (
                        <div className="kb-palette-empty">
                            Press <kbd>Enter</kbd> to ask the Master Agent
                        </div>
                    )}
                    {filtered.length === 0 && !query.trim() && (
                        <div className="kb-palette-empty">Type to search or ask the agent</div>
                    )}
                    {filtered.slice(0, 20).map((item, idx) => (
                        <div
                            key={item.id}
                            className={`kb-palette-item ${idx === selectedIdx ? 'kb-palette-item--selected' : ''}`}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIdx(idx)}
                        >
                            <span className="kb-palette-item-icon">{item.icon}</span>
                            <div className="kb-palette-item-text">
                                <span className="kb-palette-item-label">{item.label}</span>
                                {item.subtitle && (
                                    <span className="kb-palette-item-subtitle">{item.subtitle}</span>
                                )}
                            </div>
                            <span className="kb-palette-item-type">{item.type}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// Dispatch custom event for KanbanPage to handle
function dispatch(detail) {
    window.dispatchEvent(new CustomEvent('kb-command', { detail }))
}
