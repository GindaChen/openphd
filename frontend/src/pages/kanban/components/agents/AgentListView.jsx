import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../store/api'

/**
 * AgentListView — full-page view showing all persisted agents.
 * Each agent shows its display name, type, status, and creation time.
 * Clicking an agent could open its chat (wired later).
 */
export default function AgentListView() {
    const [agents, setAgents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadAgents = useCallback(async () => {
        try {
            setLoading(true)
            const data = await apiFetch('/agents/list')
            setAgents(Array.isArray(data) ? data : [])
            setError(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadAgents() }, [loadAgents])

    const statusEmoji = {
        created: '🆕',
        running: '🔄',
        stopped: '⏹',
        idle: '💤',
        error: '❌',
    }

    const formatTime = (iso) => {
        if (!iso) return '—'
        const d = new Date(iso)
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="kb-agents-view">
            <div className="kb-agents-header">
                <h2 className="kb-agents-title">🤖 Agents</h2>
                <button className="kb-agents-refresh" onClick={loadAgents} title="Refresh">↻</button>
            </div>

            {loading && <div className="kb-agents-loading">Loading agents…</div>}
            {error && <div className="kb-agents-error">⚠ {error}</div>}

            {!loading && agents.length === 0 && (
                <div className="kb-agents-empty">
                    <p>No agents yet.</p>
                    <p className="kb-agents-empty-hint">Start a chat from the Home view to create your first agent.</p>
                </div>
            )}

            <div className="kb-agents-list">
                {agents.map(agent => (
                    <div key={agent.agentId} className={`kb-agents-card kb-agents-card--${agent.status || 'unknown'}`}>
                        <div className="kb-agents-card-header">
                            <span className="kb-agents-card-status">{statusEmoji[agent.status] || '❓'}</span>
                            <span className="kb-agents-card-name">{agent.displayName || agent.agentId}</span>
                            <span className="kb-agents-card-type">{agent.type}</span>
                        </div>
                        <div className="kb-agents-card-meta">
                            <span className="kb-agents-card-model">{agent.model || '—'}</span>
                            <span className="kb-agents-card-time">{formatTime(agent.createdAt)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
