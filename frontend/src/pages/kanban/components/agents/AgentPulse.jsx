import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../store/api'

/**
 * AgentPulse — compact, always-visible agent heartbeat indicator.
 * Polls /agents/fleet every 5s and shows running/idle status.
 * Expands on click to show task details.
 */
export default function AgentPulse() {
    const [fleet, setFleet] = useState(null)
    const [tasks, setTasks] = useState([])
    const [expanded, setExpanded] = useState(false)
    const [error, setError] = useState(false)

    const poll = useCallback(async () => {
        try {
            const data = await apiFetch('/agents/fleet')
            setFleet(data)
            setError(false)
        } catch {
            setError(true)
        }
    }, [])

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch('/agents/tasks')
            setTasks(Array.isArray(data) ? data.slice(0, 8) : [])
        } catch { /* ignore */ }
    }, [])

    useEffect(() => {
        poll()
        const interval = setInterval(poll, 5000)
        return () => clearInterval(interval)
    }, [poll])

    useEffect(() => {
        if (expanded) loadTasks()
    }, [expanded, loadTasks])

    const status = error
        ? 'error'
        : fleet?.running > 0
            ? 'active'
            : 'idle'

    const statusColor = {
        idle: 'var(--color-success, #34d399)',
        active: 'var(--color-warning, #fbbf24)',
        error: 'var(--color-danger, #f87171)',
    }

    return (
        <div className="agent-pulse-wrap">
            <button
                className={`agent-pulse-indicator ${status}`}
                onClick={() => setExpanded(e => !e)}
                data-tooltip={
                    error ? 'Agents: error'
                        : fleet ? `${fleet.running} running · ${fleet.memory_entries} memories`
                            : 'Loading...'
                }
            >
                <span
                    className={`agent-pulse-dot ${status}`}
                    style={{ '--pulse-color': statusColor[status] }}
                />
                <span className="agent-pulse-label">
                    {error ? '!' : fleet?.running || 0}
                </span>
            </button>

            {expanded && (
                <div className="agent-pulse-panel">
                    <div className="agent-pulse-panel-header">
                        <span>🤖 Agent Fleet</span>
                        <button className="agent-pulse-panel-close" onClick={() => setExpanded(false)}>✕</button>
                    </div>

                    {fleet && (
                        <div className="agent-pulse-stats">
                            <div className="agent-pulse-stat">
                                <span className="agent-pulse-stat-value">{fleet.running}</span>
                                <span className="agent-pulse-stat-label">Running</span>
                            </div>
                            <div className="agent-pulse-stat">
                                <span className="agent-pulse-stat-value">{fleet.completed}</span>
                                <span className="agent-pulse-stat-label">Done</span>
                            </div>
                            <div className="agent-pulse-stat">
                                <span className="agent-pulse-stat-value">{fleet.pending}</span>
                                <span className="agent-pulse-stat-label">Pending</span>
                            </div>
                            <div className="agent-pulse-stat">
                                <span className="agent-pulse-stat-value">{fleet.memory_entries}</span>
                                <span className="agent-pulse-stat-label">Memories</span>
                            </div>
                        </div>
                    )}

                    <div className="agent-pulse-tasks">
                        <div className="agent-pulse-tasks-header">Recent Tasks</div>
                        {tasks.length === 0 && (
                            <div className="agent-pulse-empty">No tasks yet. Chat with the agent to create some.</div>
                        )}
                        {tasks.map(t => (
                            <div key={t.task_id} className={`agent-pulse-task ${t.status}`}>
                                <span className="agent-pulse-task-status">
                                    {{ pending: '⏳', running: '🔄', completed: '✅', failed: '❌' }[t.status] || '❓'}
                                </span>
                                <span className="agent-pulse-task-goal">{t.goal}</span>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div className="agent-pulse-error">
                            Could not reach agent service. Is the backend running?
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
