import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { KanbanProvider, useKanban } from './store/kanbanData'
import { loadSettings, setSetting } from './store/settings'
import { apiFetch } from './store/api'
import KanbanBoard from './components/board/KanbanBoard'
import TimelineView from './components/board/TimelineView'
import TeamItemsView from './components/board/TeamItemsView'
import IssueDetailPanel from './components/detail/IssueDetailPanel'
import MasterChat from './components/chat/MasterChat'
import ContextDashboard from './components/home/ContextDashboard'
import ProjectSidebar from './components/sidebar/ProjectSidebar'
import SettingsPanel from './components/settings/SettingsPanel'
import SyncDialog from './components/settings/SyncDialog'
import CreateIssueDialog from './components/palette/CreateIssueDialog'
import CommandPalette from './components/palette/CommandPalette'
import OnboardingWizard from './components/onboarding/OnboardingWizard'
import { useKeyboard } from './hooks/useKeyboard'
import { useResizable } from './hooks/useResizable'
import { useRegisterCommands, useCommandPalette } from '../../contexts/CommandContext'
import './kanban.css'

/** Resizable Home View — dashboard (left) + chat (right) */
function HomeView({ onToggle }) {
    const containerRef = useRef(null)
    const { width: dashWidth, handleMouseDown } = useResizable({
        percentBased: true,
        containerRef,
        minPercent: 2,
        maxPercent: 98,
        initialPercent: 30,
        storageKey: 'kb-home-dash-pct',
        reverse: true,
    })

    return (
        <div className="kb-home-view" ref={containerRef}>
            <div className="kb-home-dashboard" style={{ width: dashWidth }}>
                <ContextDashboard />
            </div>
            <div className="kb-home-resize" onMouseDown={handleMouseDown} />
            <div className="kb-home-chat">
                <MasterChat isOpen={true} onToggle={onToggle} />
            </div>
        </div>
    )
}

function KanbanInner() {
    const [selectedIssue, setSelectedIssue] = useState(null)
    const [askOpen, setAskOpen] = useState(() => loadSettings().askPanelOpen)
    const [currentProject, setCurrentProject] = useState('default')
    const [currentView, setCurrentView] = useState(() => {
        const saved = loadSettings().defaultView
        return saved === 'chat' ? 'board' : (saved || 'board')  // don't default to chat
    })
    const [activeNav, setActiveNav] = useState('kanban')

    const [settingsOpen, setSettingsOpen] = useState(false)
    const [showOnboarding, setShowOnboarding] = useState(() => !loadSettings().onboardingDone)
    const [syncStatus, setSyncStatus] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [syncDialog, setSyncDialog] = useState({ open: false, direction: null })
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const { state, actions } = useKanban()
    const { isOpen: paletteOpen, close: closePalette } = useCommandPalette()
    const handleCloseDetail = useCallback(() => setSelectedIssue(null), [])

    useKeyboard({ selectedIssue, onCloseDetail: handleCloseDetail })

    // ⌘J — project chat (configurable via Settings). ⌘K is now global (CommandContext).
    useEffect(() => {
        const handler = (e) => {
            if (!(e.metaKey || e.ctrlKey)) return

            const settings = loadSettings()
            const gs = settings.globalShortcuts || {}
            const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)

            // ⌘J — toggle between home (chat) and kanban
            if (e.key === (gs.projectChat || 'j')) {
                e.preventDefault()
                setActiveNav(n => n === 'home' ? 'kanban' : 'home')
                setSelectedIssue(null)
                if (inInput) e.target.blur()
                return
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Register kanban-specific commands with the global command palette
    const kanbanCommands = useMemo(() => {
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
                action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { selectIssue: issue.id } }))
                },
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
                        action: () => {
                            window.dispatchEvent(new CustomEvent('kb-command', { detail: { selectIssue: issue.id, expandSection: 'Artifacts' } }))
                        },
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
                        action: () => {
                            window.dispatchEvent(new CustomEvent('kb-command', { detail: { selectIssue: issue.id, expandSection: 'Workspaces' } }))
                        },
                    })
                }
            }
        }

        // Kanban-specific actions
        items.push(
            {
                id: 'cmd:create-issue', type: 'action', icon: '✨', label: 'Create Issue', subtitle: 'Create a new issue (dialog)', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { createIssue: true } }))
                }
            },
        )

        // Kanban views
        items.push(
            {
                id: 'cmd:board', type: 'view', icon: '📋', label: 'Board View', subtitle: 'Switch to kanban board', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { view: 'board' } }))
                }
            },
            {
                id: 'cmd:team', type: 'view', icon: '👥', label: 'Team Items', subtitle: 'Switch to team items view', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { view: 'team' } }))
                }
            },
            {
                id: 'cmd:roadmap', type: 'view', icon: '🗺️', label: 'Roadmap', subtitle: 'Switch to timeline view', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { view: 'timeline' } }))
                }
            },
            {
                id: 'cmd:chat', type: 'view', icon: '💬', label: 'Project Chat', subtitle: 'Open project-level chat (⌘J)', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { view: 'chat' } }))
                }
            },
            {
                id: 'cmd:settings', type: 'action', icon: '⚙️', label: 'Settings', subtitle: 'Open settings panel', action: () => {
                    window.dispatchEvent(new CustomEvent('kb-command', { detail: { view: 'settings' } }))
                }
            },
        )

        return items
    }, [state.issues])

    useRegisterCommands('kanban', kanbanCommands, [kanbanCommands])

    // Listen for command palette dispatched events
    useEffect(() => {
        const handler = (e) => {
            const { view, selectIssue, expandSection, createIssue: openCreateDialog, agentMessage } = e.detail

            // Agent message from Command K fallthrough
            if (agentMessage) {
                setActiveNav('home')
                setSelectedIssue(null)
                // Give MasterChat time to mount, then send the message
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('kb-agent-send', { detail: { message: agentMessage } }))
                }, 150)
                return
            }

            // Create issue dialog
            if (openCreateDialog) { setCreateDialogOpen(true); return }

            // View switching
            if (view === 'chat') { setActiveNav('home'); setSelectedIssue(null) }
            else if (view === 'settings') setSettingsOpen(true)
            else if (['board', 'team', 'timeline'].includes(view)) {
                setActiveNav('kanban')
                setCurrentView(view)
                setSetting('defaultView', view)
            }

            // Issue selection from palette
            if (selectIssue) {
                setActiveNav('kanban')
                const issue = state.issues.find(i => i.id === selectIssue)
                if (issue) {
                    setSelectedIssue(issue)
                    // If a section should be expanded, dispatch after a tick so the panel renders first
                    if (expandSection) {
                        setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('kb-expand-section', { detail: { section: expandSection } }))
                        }, 100)
                    }
                }
            }
        }
        window.addEventListener('kb-command', handler)
        return () => window.removeEventListener('kb-command', handler)
    }, [state.issues])

    // Check sync status
    useEffect(() => {
        apiFetch('/sync/status').then(setSyncStatus).catch(() => setSyncStatus({ configured: false }))
    }, [])

    // Seed projectRoot from server if not set yet
    useEffect(() => {
        const s = loadSettings()
        if (!s.projectRoot) {
            apiFetch('/browse').then(data => {
                if (data.current) {
                    setSetting('projectRoot', data.current)
                }
            }).catch(() => { })
        }
    }, [])

    const handleSync = async (direction, addLog) => {
        setSyncing(true)
        try {
            addLog(`Connecting to GitHub (${syncStatus?.repo})…`)
            const result = await apiFetch(`/sync/${direction}`, { method: 'POST', body: '{}' })

            if (direction === 'pull') {
                addLog(`Fetched ${result.total} issue(s) from GitHub`)
                if (result.labelsSynced > 0) addLog(`🏷 Synced ${result.labelsSynced} label color(s) from repo`, 'success')
                if (result.created > 0) addLog(`✅ Created ${result.created} new local issue(s)`, 'success')
                if (result.updated > 0) addLog(`✅ Updated ${result.updated} issue(s)`, 'success')
                if (result.skipped > 0) addLog(`⏭ Skipped ${result.skipped} unchanged issue(s)`, 'warn')
                if (result.total === 0) addLog('No issues found in the repository.', 'warn')
            } else {
                addLog(`Processed ${result.total} local issue(s)`)
                if (result.pushed > 0) addLog(`✅ Pushed ${result.pushed} issue(s) to GitHub`, 'success')
                if (result.skipped > 0) addLog(`⏭ Skipped ${result.skipped} issue(s)`, 'warn')
            }

            await actions.loadBoard()
            addLog('Board refreshed.', 'success')
            // Refresh sync status too
            apiFetch('/sync/status').then(setSyncStatus).catch(() => { })
        } catch (err) {
            addLog(`Failed: ${err.message}`, 'error')
        } finally {
            setSyncing(false)
        }
    }

    const handleSettingsChange = (newSettings) => {
        // Refresh sync status when settings change
        apiFetch('/sync/status').then(setSyncStatus).catch(() => { })
        // Reload board (project root may have changed)
        actions.loadBoard()
        setSetting('onboardingDone', true)
    }

    const handleToggleAsk = () => {
        const next = !askOpen
        setAskOpen(next)
        setSetting('askPanelOpen', next)
    }

    // Click on board wrapper closes detail panel (#105)
    const handleBoardClick = useCallback((e) => {
        // Only close if clicking on the board area itself, not its children
        if (selectedIssue && e.target === e.currentTarget) {
            setSelectedIssue(null)
        }
    }, [selectedIssue])

    return (
        <div className="kb-root">
            <ProjectSidebar
                currentProject={currentProject}
                onSelectProject={(id) => { setCurrentProject(id); setActiveNav('kanban') }}
                activeNav={activeNav}
                onNavChange={(nav) => { setActiveNav(nav); if (nav === 'home') setSelectedIssue(null) }}
            />

            <div className="kb-main-area">
                {activeNav === 'home' ? (
                    /* ── Home View: Dashboard + Chat split (resizable) ── */
                    <HomeView onToggle={() => setActiveNav('kanban')} />
                ) : (
                    /* ── Kanban View: Board with topbar ── */
                    <>
                        <div className="kb-topbar">
                            <div className="kb-topbar-left">
                                <span className="kb-topbar-project">📐 Research Board</span>
                                <div className="kb-topbar-views">
                                    <button
                                        className={`kb-topbar-view ${currentView === 'board' ? 'kb-topbar-view--active' : ''}`}
                                        onClick={() => { setCurrentView('board'); setSetting('defaultView', 'board') }}
                                    >Board</button>
                                    <button
                                        className={`kb-topbar-view ${currentView === 'team' ? 'kb-topbar-view--active' : ''}`}
                                        onClick={() => { setCurrentView('team'); setSetting('defaultView', 'team') }}
                                    >Team Items</button>
                                    <button
                                        className={`kb-topbar-view ${currentView === 'timeline' ? 'kb-topbar-view--active' : ''}`}
                                        onClick={() => { setCurrentView('timeline'); setSetting('defaultView', 'timeline') }}
                                    >Roadmap</button>
                                </div>
                            </div>
                            <div className="kb-topbar-right">
                                {syncStatus?.configured && (
                                    <div className="kb-topbar-sync">
                                        <a className="kb-sync-repo" href={`https://github.com/${syncStatus.repo}`} target="_blank" rel="noopener noreferrer" title={`Open ${syncStatus.repo} on GitHub`}>🔗 {syncStatus.repo}</a>
                                        <button className="kb-sync-btn" onClick={() => setSyncDialog({ open: true, direction: 'pull' })} disabled={syncing}
                                            title="Pull issues from GitHub">{syncing ? '⏳' : '⬇'} Pull</button>
                                        <button className="kb-sync-btn" onClick={() => setSyncDialog({ open: true, direction: 'push' })} disabled={syncing}
                                            title="Push issues to GitHub">{syncing ? '⏳' : '⬆'} Push</button>
                                    </div>
                                )}
                                <button
                                    className="kb-topbar-settings"
                                    onClick={() => setSettingsOpen(true)}
                                    title="Settings"
                                >⚙</button>
                            </div>
                        </div>

                        <div className="kb-filterbar">
                            <input className="kb-filter-input" placeholder="Filter by keyword or by field" />
                            <div className="kb-filter-actions">
                                <button className="kb-filter-btn">👤 Group by</button>
                                <button className="kb-filter-btn">↕ Sort</button>
                                <button className="kb-filter-btn">⚙ View</button>
                            </div>
                        </div>

                        <div className="kb-content">
                            {/* Board/Timeline area — flex with detail panel */}
                            <div className="kb-content-body">
                                <div className="kb-board-wrapper" onClick={handleBoardClick}>
                                    {currentView === 'board' && (
                                        <KanbanBoard onSelectIssue={setSelectedIssue} />
                                    )}
                                    {currentView === 'team' && (
                                        <TeamItemsView onSelectIssue={setSelectedIssue} />
                                    )}
                                    {currentView === 'timeline' && (
                                        <TimelineView onSelectIssue={setSelectedIssue} />
                                    )}
                                </div>

                                {/* Detail panel sits in the flex flow, not absolute (#99) */}
                                {selectedIssue && (
                                    <IssueDetailPanel
                                        issue={selectedIssue}
                                        onClose={() => setSelectedIssue(null)}
                                        onUpdateIssue={actions.updateIssue}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showOnboarding && (
                <OnboardingWizard
                    onComplete={(s) => {
                        setShowOnboarding(false)
                        handleSettingsChange(s)
                    }}
                />
            )}

            <SettingsPanel
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onSettingsChange={handleSettingsChange}
            />

            <CreateIssueDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onCreated={(issue) => { setSelectedIssue(issue) }}
            />
            <SyncDialog
                isOpen={syncDialog.open}
                direction={syncDialog.direction}
                onClose={() => setSyncDialog({ open: false, direction: null })}
                onSync={handleSync}
            />

            <CommandPalette isOpen={paletteOpen} onClose={closePalette} />
        </div>
    )
}

export default function KanbanPage() {
    return (
        <KanbanProvider>
            <KanbanInner />
        </KanbanProvider>
    )
}
