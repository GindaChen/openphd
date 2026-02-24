import { useState, useEffect } from 'react'
import { apiFetch } from '../../store/api'

/**
 * CreateProjectDialog — Project initialization flow.
 *
 * Two modes:
 * 1. Local directory — user picks an absolute path; backend checks for .git
 * 2. Playground — auto-generated under ~/.openphd/playgrounds/<random-name>
 */

// ── 2-word playground name generator ──
const ADJECTIVES = [
    'swift', 'bright', 'calm', 'bold', 'deep', 'keen', 'warm', 'cool',
    'vivid', 'noble', 'lucid', 'agile', 'dense', 'grand', 'rapid', 'sharp',
    'sleek', 'solar', 'lunar', 'coral', 'amber', 'azure', 'ivory', 'cedar',
    'frost', 'blaze', 'drift', 'gleam', 'prism', 'pulse', 'surge', 'orbit',
]
const NOUNS = [
    'falcon', 'prism', 'nexus', 'atlas', 'forge', 'spark', 'bloom', 'crest',
    'haven', 'ridge', 'vault', 'delta', 'grove', 'flame', 'pearl', 'stone',
    'orbit', 'cedar', 'lotus', 'maple', 'cliff', 'brook', 'dune', 'peak',
    'reef', 'glade', 'marsh', 'fjord', 'mesa', 'tide', 'nova', 'comet',
]

function generatePlaygroundName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    return `${adj}-${noun}`
}

export default function CreateProjectDialog({ isOpen, onClose, onProjectCreated }) {
    const [mode, setMode] = useState('directory')   // 'directory' | 'playground'
    const [dirPath, setDirPath] = useState('')
    const [playgroundName, setPlaygroundName] = useState(generatePlaygroundName)
    const [browsePath, setBrowsePath] = useState('')
    const [browseDirs, setBrowseDirs] = useState([])
    const [browseParent, setBrowseParent] = useState('')
    const [browseOpen, setBrowseOpen] = useState(false)
    const [checking, setChecking] = useState(false)
    const [dirInfo, setDirInfo] = useState(null)  // { exists, isGit, gitRemote, hasAgents }
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setMode('directory')
            setDirPath('')
            setPlaygroundName(generatePlaygroundName())
            setDirInfo(null)
            setError(null)
            setBrowseOpen(false)
        }
    }, [isOpen])

    // Check directory when path changes
    useEffect(() => {
        if (!dirPath || mode !== 'directory') { setDirInfo(null); return }
        const timer = setTimeout(async () => {
            setChecking(true)
            setError(null)
            try {
                const info = await apiFetch(`/check-dir?path=${encodeURIComponent(dirPath)}`)
                setDirInfo(info)
            } catch (err) {
                setDirInfo(null)
                setError(err.message)
            } finally {
                setChecking(false)
            }
        }, 500) // debounce
        return () => clearTimeout(timer)
    }, [dirPath, mode])

    const handleBrowse = async (targetPath) => {
        try {
            const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
            const res = await fetch(`/api/kanban/browse${params}`)
            const data = await res.json()
            if (!res.ok) { setError(data.error); return }
            setBrowsePath(data.current)
            setBrowseParent(data.parent)
            setBrowseDirs(data.dirs)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleCreate = async () => {
        setCreating(true)
        setError(null)
        try {
            const body = mode === 'playground'
                ? { mode: 'playground', name: playgroundName }
                : { mode: 'directory', path: dirPath }

            const result = await apiFetch('/init-project', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            onProjectCreated?.({
                id: result.projectId,
                name: result.name,
                emoji: result.emoji || '📂',
                root: result.root,
                isGit: result.isGit,
            })
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="kb-settings-overlay" onClick={onClose}>
            <div className="kb-settings-panel kb-create-project-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="kb-settings-header">
                    <h2>🚀 New Project</h2>
                    <button className="kb-settings-close" onClick={onClose}>✕</button>
                </div>

                {/* ── Mode Tabs ── */}
                <div className="kb-settings-tabs">
                    <button
                        className={`kb-settings-tab ${mode === 'directory' ? 'kb-settings-tab--active' : ''}`}
                        onClick={() => setMode('directory')}
                    >📁 Local Directory</button>
                    <button
                        className={`kb-settings-tab ${mode === 'playground' ? 'kb-settings-tab--active' : ''}`}
                        onClick={() => setMode('playground')}
                    >🏖️ Playground</button>
                </div>

                <div className="kb-settings-body" style={{ padding: '16px' }}>
                    {mode === 'directory' && (
                        <div className="kb-settings-section">
                            <p className="kb-settings-hint" style={{ marginBottom: '12px' }}>
                                Select a local directory. If it's a Git repo, issues will be synced.
                            </p>

                            <label className="kb-settings-label">
                                Project Path
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        className="kb-settings-input"
                                        placeholder="/path/to/your/project"
                                        value={dirPath}
                                        onChange={e => setDirPath(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => { setBrowseOpen(o => !o); if (!browseOpen) handleBrowse(dirPath || '') }}
                                        style={{ padding: '6px 10px', fontSize: '13px', whiteSpace: 'nowrap' }}
                                    >📂 Browse</button>
                                </div>
                            </label>

                            {/* File browser */}
                            {browseOpen && (
                                <div className="ctx-file-browser" style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', fontFamily: 'monospace' }}>
                                        {browsePath || '~'}
                                    </div>
                                    {browseParent && (
                                        <button
                                            className="ctx-add-menu-item"
                                            style={{ width: '100%', flexDirection: 'row', gap: '6px', padding: '4px 8px', fontSize: '11px' }}
                                            onClick={() => handleBrowse(browseParent)}
                                        >⬆ ..</button>
                                    )}
                                    {browseDirs.map(d => (
                                        <button
                                            key={d}
                                            className="ctx-add-menu-item"
                                            style={{ width: '100%', flexDirection: 'row', gap: '6px', padding: '4px 8px', fontSize: '11px', justifyContent: 'flex-start' }}
                                            onClick={() => {
                                                const full = `${browsePath}/${d}`
                                                handleBrowse(full)
                                                setDirPath(full)
                                            }}
                                        >📁 {d}</button>
                                    ))}
                                    {browseDirs.length === 0 && (
                                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', padding: '8px' }}>
                                            No subdirectories
                                        </div>
                                    )}
                                    <button
                                        className="btn"
                                        style={{ width: '100%', marginTop: '6px', fontSize: '11px', padding: '5px' }}
                                        onClick={() => { setDirPath(browsePath); setBrowseOpen(false) }}
                                    >✓ Use this directory</button>
                                </div>
                            )}

                            {/* Directory status */}
                            {checking && (
                                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                    Checking directory…
                                </div>
                            )}

                            {dirInfo && !checking && (
                                <div className="kb-settings-status-grid" style={{ marginTop: '10px' }}>
                                    <div className={`kb-settings-status-item ${dirInfo.exists ? 'active' : ''}`}>
                                        <span className="kb-settings-status-icon">{dirInfo.exists ? '✅' : '🆕'}</span>
                                        <span>{dirInfo.exists ? 'Exists' : 'Will be created'}</span>
                                    </div>
                                    <div className={`kb-settings-status-item ${dirInfo.isGit ? 'active' : ''}`}>
                                        <span className="kb-settings-status-icon">{dirInfo.isGit ? '✅' : '⬜'}</span>
                                        <span>{dirInfo.isGit ? 'Git repo' : 'Not a Git repo'}</span>
                                    </div>
                                    {dirInfo.gitRemote && (
                                        <div className="kb-settings-status-item active" style={{ gridColumn: 'span 2' }}>
                                            <span className="kb-settings-status-icon">🔗</span>
                                            <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>{dirInfo.gitRemote}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'playground' && (
                        <div className="kb-settings-section">
                            <p className="kb-settings-hint" style={{ marginBottom: '12px' }}>
                                Create a quick sandbox project under <code style={{ fontSize: '11px' }}>~/.openphd/playgrounds/</code>.
                                No Git setup needed — great for experiments and scratch work.
                            </p>

                            <label className="kb-settings-label">
                                Playground Name
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        className="kb-settings-input"
                                        value={playgroundName}
                                        onChange={e => setPlaygroundName(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => setPlaygroundName(generatePlaygroundName())}
                                        style={{ padding: '6px 10px', fontSize: '13px', whiteSpace: 'nowrap' }}
                                        title="Regenerate name"
                                    >🎲</button>
                                </div>
                            </label>

                            <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                                📁 ~/.openphd/playgrounds/{playgroundName}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px', fontSize: '11px', color: '#f87171' }}>
                            ⚠ {error}
                        </div>
                    )}
                </div>

                <div className="kb-settings-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn" onClick={onClose} style={{ padding: '8px 16px' }}>
                        Cancel
                    </button>
                    <button
                        className="kb-settings-save"
                        onClick={handleCreate}
                        disabled={creating || (mode === 'directory' && !dirPath) || (mode === 'playground' && !playgroundName)}
                    >
                        {creating ? '⏳ Creating…' : '🚀 Create Project'}
                    </button>
                </div>
            </div>
        </div>
    )
}
