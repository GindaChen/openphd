import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../store/api'

/**
 * MemoryPanel — view, search, and add agent memory entries.
 * Connects to GET/POST /agents/memory and GET /agents/memory/search.
 */
export default function MemoryPanel() {
    const [entries, setEntries] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [addOpen, setAddOpen] = useState(false)
    const [newKey, setNewKey] = useState('')
    const [newContent, setNewContent] = useState('')
    const [newTags, setNewTags] = useState('')
    const [saving, setSaving] = useState(false)

    const loadEntries = useCallback(async () => {
        setLoading(true)
        try {
            const data = search
                ? await apiFetch(`/agents/memory/search?q=${encodeURIComponent(search)}&limit=20`)
                : await apiFetch('/agents/memory')
            setEntries(Array.isArray(data) ? data : [])
        } catch { setEntries([]) }
        setLoading(false)
    }, [search])

    useEffect(() => {
        loadEntries()
    }, [loadEntries])

    const handleAdd = async () => {
        if (!newKey.trim() || !newContent.trim()) return
        setSaving(true)
        try {
            await apiFetch('/agents/memory', {
                method: 'POST',
                body: JSON.stringify({
                    key: newKey.trim(),
                    content: newContent.trim(),
                    tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
                    source: 'user',
                }),
            })
            setNewKey('')
            setNewContent('')
            setNewTags('')
            setAddOpen(false)
            loadEntries()
        } catch { /* ignore */ }
        setSaving(false)
    }

    const formatTime = (ts) => {
        if (!ts) return ''
        const d = new Date(ts * 1000)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="memory-panel">
            <div className="memory-panel-header">
                <h3>🧠 Agent Memory</h3>
                <button
                    className="memory-panel-add-btn"
                    onClick={() => setAddOpen(o => !o)}
                    title="Add memory entry"
                >
                    {addOpen ? '✕' : '＋'}
                </button>
            </div>

            <div className="memory-panel-search">
                <input
                    className="memory-panel-search-input"
                    placeholder="Search memories..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {addOpen && (
                <div className="memory-panel-add-form">
                    <input
                        className="memory-panel-input"
                        placeholder="Key (unique identifier)"
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                    />
                    <textarea
                        className="memory-panel-textarea"
                        placeholder="What should the agent remember?"
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        rows={3}
                    />
                    <input
                        className="memory-panel-input"
                        placeholder="Tags (comma-separated)"
                        value={newTags}
                        onChange={e => setNewTags(e.target.value)}
                    />
                    <button
                        className="memory-panel-save-btn"
                        onClick={handleAdd}
                        disabled={saving || !newKey.trim() || !newContent.trim()}
                    >
                        {saving ? '⏳ Saving...' : '💾 Save Memory'}
                    </button>
                </div>
            )}

            <div className="memory-panel-entries">
                {loading && <div className="memory-panel-loading">Loading...</div>}
                {!loading && entries.length === 0 && (
                    <div className="memory-panel-empty">
                        {search ? 'No matching memories.' : 'No memories yet. Chat with the agent or add one above.'}
                    </div>
                )}
                {entries.map((entry, i) => (
                    <div key={entry.key || i} className="memory-entry">
                        <div className="memory-entry-header">
                            <span className="memory-entry-key">{entry.key}</span>
                            <span className="memory-entry-source">{entry.source === 'agent' ? '🤖' : '👤'}</span>
                        </div>
                        <div className="memory-entry-content">{entry.content}</div>
                        <div className="memory-entry-footer">
                            {entry.tags?.length > 0 && (
                                <div className="memory-entry-tags">
                                    {entry.tags.map(t => (
                                        <span key={t} className="memory-entry-tag">{t}</span>
                                    ))}
                                </div>
                            )}
                            <span className="memory-entry-time">{formatTime(entry.timestamp)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
