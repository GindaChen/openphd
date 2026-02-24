import { useState, useEffect } from 'react'
import { loadSettings, saveSettings, SETTING_DEFAULTS } from '../../store/settings'
import { apiFetch } from '../../store/api'
import FileTree from '../../../../components/ui/FileTree'
import AISettingsSection from './AISettingsSection'

const SHORTCUT_LABELS = {
    openIssue: 'Open Issue',
    closePanel: 'Close Panel',
}

const GLOBAL_SHORTCUT_LABELS = {
    commandPalette: 'Command Palette',
    projectChat: 'Project Chat',
}

const KEY_DISPLAY = {
    ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→',
    Enter: '⏎', Escape: 'Esc', ' ': 'Space',
}

export default function SettingsPanel({ isOpen, onClose, onSettingsChange }) {
    const [settings, setSettings] = useState(loadSettings)
    const [activeTab, setActiveTab] = useState('general')
    const [recording, setRecording] = useState(null) // which shortcut is being recorded
    const [saved, setSaved] = useState(false)
    const [browseOpen, setBrowseOpen] = useState(false)
    const [browsePath, setBrowsePath] = useState('')
    const [browseDirs, setBrowseDirs] = useState([])
    const [browseParent, setBrowseParent] = useState('')
    const [browseError, setBrowseError] = useState(null)
    const [setupStatus, setSetupStatus] = useState(null) // null | 'working' | 'done' | 'error'
    const [setupMsg, setSetupMsg] = useState('')


    const handleBrowse = async (targetPath) => {
        try {
            setBrowseError(null)
            const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
            const res = await fetch(`/api/kanban/browse${params}`)
            const data = await res.json()
            if (!res.ok) { setBrowseError(data.error); return }
            setBrowsePath(data.current)
            setBrowseParent(data.parent)
            setBrowseDirs(data.dirs)
        } catch (err) {
            setBrowseError(err.message)
        }
    }

    // Load initial browse content when opened
    useEffect(() => {
        if (browseOpen && !browsePath) {
            handleBrowse(settings.projectRoot || '')
        }
    }, [browseOpen])

    useEffect(() => {
        if (isOpen) setSettings(loadSettings())
    }, [isOpen])

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    const updateShortcut = (action, key) => {
        setSettings(prev => ({
            ...prev,
            shortcuts: { ...prev.shortcuts, [action]: key },
        }))
        setSaved(false)
    }

    const updateGlobalShortcut = (action, key) => {
        setSettings(prev => ({
            ...prev,
            globalShortcuts: { ...prev.globalShortcuts, [action]: key },
        }))
        setSaved(false)
    }

    const handleSave = () => {
        saveSettings(settings)
        setSaved(true)
        onSettingsChange?.(settings)
        setTimeout(() => setSaved(false), 2000)
    }

    const handleReset = () => {
        setSettings({ ...SETTING_DEFAULTS })
        setSaved(false)
    }

    // Listen for key when recording a shortcut
    useEffect(() => {
        if (!recording) return
        const handler = (e) => {
            e.preventDefault()
            e.stopPropagation()
            // Skip modifier-only keys for global shortcuts
            if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
            if (recording.startsWith('global:')) {
                updateGlobalShortcut(recording.slice(7), e.key.toLowerCase())
            } else {
                updateShortcut(recording, e.key)
            }
            setRecording(null)
        }
        window.addEventListener('keydown', handler, true)
        return () => window.removeEventListener('keydown', handler, true)
    }, [recording])

    if (!isOpen) return null

    return (
        <div className="kb-settings-overlay" onClick={onClose}>
            <div className="kb-settings-panel" onClick={e => e.stopPropagation()}>
                <div className="kb-settings-header">
                    <h2>⚙ Settings</h2>
                    <button className="kb-settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="kb-settings-tabs">
                    {[
                        { id: 'general', label: '🏠 Setup' },
                        { id: 'appearance', label: '🎨 Appearance' },
                        { id: 'shortcuts', label: '⌨ Shortcuts' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`kb-settings-tab ${activeTab === tab.id ? 'kb-settings-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >{tab.label}</button>
                    ))}
                </div>

                <div className="kb-settings-body">
                    {activeTab === 'general' && (
                        <div className="kb-settings-section">
                            <h3>🚀 Getting Started</h3>
                            <p className="kb-settings-hint">
                                Configure your connections below. All settings are saved locally in your browser.
                            </p>

                            <label className="kb-settings-label">
                                📁 Project Root
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        className="kb-settings-input"
                                        placeholder="Leave empty for server default"
                                        value={settings.projectRoot}
                                        onChange={e => update('projectRoot', e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => setBrowseOpen(o => !o)}
                                        style={{ padding: '6px 10px', fontSize: '13px', whiteSpace: 'nowrap' }}
                                    >📂 Browse</button>
                                </div>
                                <span className="kb-settings-hint" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                                    Absolute path to a kanban data directory on the server.
                                    A new project is auto-created if the path doesn't exist yet.
                                </span>
                            </label>

                            {browseOpen && (
                                <FileTree
                                    currentPath={browsePath}
                                    dirs={browseDirs}
                                    parentPath={browseParent}
                                    error={browseError}
                                    onNavigate={handleBrowse}
                                    onSelect={(path) => { update('projectRoot', path); setBrowseOpen(false) }}
                                />
                            )}

                            <div className="kb-settings-status-grid">
                                <div className={`kb-settings-status-item ${settings.projectRoot ? 'active' : ''}`}>
                                    <span className="kb-settings-status-icon">{settings.projectRoot ? '📂' : '🏠'}</span>
                                    <span>{settings.projectRoot ? 'Custom Root' : 'Default Root'}</span>
                                </div>
                                <div className={`kb-settings-status-item ${settings.githubToken ? 'active' : ''}`}>
                                    <span className="kb-settings-status-icon">{settings.githubToken ? '✅' : '⬜'}</span>
                                    <span>GitHub Sync</span>
                                </div>
                                <div className={`kb-settings-status-item ${settings.llmApiKey ? 'active' : ''}`}>
                                    <span className="kb-settings-status-icon">{settings.llmApiKey ? '✅' : '⬜'}</span>
                                    <span>AI Assistant</span>
                                </div>
                                <div className="kb-settings-status-item active">
                                    <span className="kb-settings-status-icon">✅</span>
                                    <span>Local Board</span>
                                </div>
                            </div>
                            <p className="kb-settings-hint" style={{ marginTop: 16 }}>
                                <strong>Tip:</strong> Everything works locally without any API keys.
                                Connect GitHub and AI for extra features.
                                Changing the project root will reload the board.
                            </p>

                            <h3 style={{ marginTop: '24px' }}>🔗 GitHub Integration</h3>
                            <p className="kb-settings-hint">Sync issues bidirectionally with a GitHub repository.</p>
                            <label className="kb-settings-label">
                                GitHub Token
                                <input
                                    className="kb-settings-input"
                                    type="password"
                                    placeholder="ghp_... or github_pat_..."
                                    value={settings.githubToken}
                                    onChange={e => update('githubToken', e.target.value)}
                                />
                            </label>
                            <label className="kb-settings-label">
                                Repository
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        className="kb-settings-input"
                                        placeholder="owner/repo"
                                        value={settings.githubRepo}
                                        onChange={e => update('githubRepo', e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    {settings.githubRepo && (
                                        <a
                                            href={`https://github.com/${settings.githubRepo}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`Open ${settings.githubRepo} on GitHub`}
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: '13px',
                                                textDecoration: 'none',
                                                color: 'var(--text-secondary, #aaa)',
                                                transition: 'color 0.15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary, #fff)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary, #aaa)'}
                                            onClick={e => e.stopPropagation()}
                                        >↗</a>
                                    )}
                                </div>
                            </label>

                            {settings.githubToken && settings.githubRepo && (
                                <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg, #111)', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>🏷 Setup Labels</div>
                                            <p className="kb-settings-hint" style={{ margin: '4px 0 0' }}>Create priority labels on your GitHub repo for kanban sync.</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn"
                                            disabled={setupStatus === 'working'}
                                            style={{ padding: '6px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                                            onClick={async () => {
                                                setSetupStatus('working')
                                                setSetupMsg('')
                                                try {
                                                    const result = await apiFetch('/sync/setup-labels', { method: 'POST', body: '{}' })
                                                    setSetupStatus('done')
                                                    const parts = []
                                                    if (result.created > 0) parts.push(`${result.created} created`)
                                                    if (result.existing > 0) parts.push(`${result.existing} already exist`)
                                                    if (result.failed > 0) parts.push(`${result.failed} failed`)
                                                    setSetupMsg(parts.join(', '))
                                                    setTimeout(() => setSetupStatus(null), 5000)
                                                } catch (err) {
                                                    setSetupStatus('error')
                                                    setSetupMsg(err.message)
                                                }
                                            }}
                                        >
                                            {setupStatus === 'working' ? '⏳ Working…' : setupStatus === 'done' ? '✓ Done' : '🏷 Setup'}
                                        </button>
                                    </div>
                                    {setupMsg && (
                                        <p style={{ fontSize: 11, marginTop: 6, color: setupStatus === 'error' ? '#f87171' : 'var(--text-secondary)' }}>{setupMsg}</p>
                                    )}
                                </div>
                            )}

                            <AISettingsSection settings={settings} update={update} />

                            {/* ── Danger Zone ── */}
                            <h3 style={{ marginTop: '24px' }}>⚠️ Danger Zone</h3>
                            <div className="ai-conn-card" style={{ borderColor: 'rgba(248, 113, 113, 0.3)' }}>
                                <div className="ai-conn-header">
                                    <div>
                                        <div className="ai-conn-title">🗑 Clear Local Data</div>
                                        <p className="kb-settings-hint" style={{ margin: '2px 0 0' }}>
                                            Delete all local issues and reset. Board layout and labels are preserved.
                                            Re-sync from GitHub to restore issues.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn kb-danger-btn"
                                        onClick={async () => {
                                            if (!window.confirm(
                                                'This will delete ALL local issues. Board config (columns, labels, priorities) will be preserved.\n\nYou can re-sync from GitHub afterwards.\n\nAre you sure?'
                                            )) return
                                            try {
                                                await apiFetch('/data/reset', { method: 'DELETE' })
                                                window.location.reload()
                                            } catch (err) {
                                                alert('Reset failed: ' + err.message)
                                            }
                                        }}
                                    >
                                        🗑 Clear All
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="kb-settings-section">
                            <h3>🔤 Typography</h3>
                            <label className="kb-settings-label">
                                Font Size: {settings.fontSize || 14}px
                                <input
                                    type="range"
                                    min="8"
                                    max="32"
                                    step="1"
                                    value={settings.fontSize || 14}
                                    onChange={e => update('fontSize', parseInt(e.target.value))}
                                    style={{ width: '100%', marginTop: '6px' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                    <span>8px (compact)</span>
                                    <span>14px (default)</span>
                                    <span>32px (large)</span>
                                </div>
                            </label>

                            <h3 style={{ marginTop: '20px' }}>🎨 Board Layout</h3>
                            <label className="kb-settings-label">
                                Kanban Column Width: {settings.kanbanColumnWidth || 280}px
                                <input
                                    type="range"
                                    min="180"
                                    max="500"
                                    step="10"
                                    value={settings.kanbanColumnWidth || 280}
                                    onChange={e => update('kanbanColumnWidth', parseInt(e.target.value))}
                                    style={{ width: '100%', marginTop: '6px' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                    <span>180px</span>
                                    <span>500px</span>
                                </div>
                            </label>
                        </div>
                    )}

                    {activeTab === 'shortcuts' && (
                        <div className="kb-settings-section">
                            <h3>⌨ Keyboard Shortcuts</h3>
                            <p className="kb-settings-hint">Click a shortcut to re-bind it. Press any key to assign.</p>
                            <div className="kb-settings-shortcuts">
                                {Object.entries(SHORTCUT_LABELS).map(([action, label]) => (
                                    <div key={action} className="kb-shortcut-row">
                                        <span className="kb-shortcut-label">{label}</span>
                                        <button
                                            className={`kb-shortcut-key ${recording === action ? 'kb-shortcut-key--recording' : ''}`}
                                            onClick={() => setRecording(recording === action ? null : action)}
                                        >
                                            {recording === action
                                                ? '⏺ Press a key...'
                                                : KEY_DISPLAY[settings.shortcuts[action]] || settings.shortcuts[action]
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <h3 style={{ marginTop: '20px' }}>🚀 Global Shortcuts</h3>
                            <p className="kb-settings-hint">Used with ⌘/Ctrl. Click to re-bind.</p>
                            <div className="kb-settings-shortcuts">
                                {Object.entries(GLOBAL_SHORTCUT_LABELS).map(([action, label]) => (
                                    <div key={action} className="kb-shortcut-row">
                                        <span className="kb-shortcut-label">{label}</span>
                                        <button
                                            className={`kb-shortcut-key ${recording === `global:${action}` ? 'kb-shortcut-key--recording' : ''}`}
                                            onClick={() => setRecording(recording === `global:${action}` ? null : `global:${action}`)}
                                        >
                                            {recording === `global:${action}`
                                                ? '⏺ Press a key...'
                                                : `⌘${(settings.globalShortcuts?.[action] || '').toUpperCase()}`
                                            }
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button className="kb-settings-reset" onClick={handleReset}>
                                ↺ Reset to Defaults
                            </button>
                        </div>
                    )}
                </div>

                <div className="kb-settings-footer">
                    <button className="kb-settings-save" onClick={handleSave}>
                        {saved ? '✓ Saved!' : '💾 Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    )
}
