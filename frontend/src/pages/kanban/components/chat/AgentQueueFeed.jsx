import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../../store/api'

const POLL_INTERVAL = 3000 // 3 seconds
const DIRECTION_ICONS = { in: '📥', out: '📤' }
const STATUS_ICONS = { running: '🟢', complete: '✅', error: '❌', starting: '🟡', unknown: '⚪' }

/**
 * AgentQueueFeed — reads the backend's JSONL mailboxes directly.
 * Backend is ground truth; this component just renders it.
 */
export default function AgentQueueFeed({ sessionId }) {
    const [messages, setMessages] = useState([])
    const [agents, setAgents] = useState([])
    const [cursor, setCursor] = useState(0)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(true)
    const feedEndRef = useRef(null)

    const fetchQueue = useCallback(async (afterCursor = 0) => {
        if (!sessionId) return
        try {
            const data = await apiFetch(`/agents/queue?sessionId=${encodeURIComponent(sessionId)}&after=${afterCursor}`)
            if (data.messages?.length > 0) {
                setMessages(prev => [...prev, ...data.messages])
            }
            if (data.cursor != null) setCursor(data.cursor)
            if (data.agents) setAgents(data.agents)
            setError(data.error || null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [sessionId])

    // Initial fetch
    useEffect(() => {
        setMessages([])
        setCursor(0)
        setLoading(true)
        fetchQueue(0)
    }, [sessionId, fetchQueue])

    // Poll for new messages
    useEffect(() => {
        if (!sessionId) return
        const timer = setInterval(() => fetchQueue(cursor), POLL_INTERVAL)
        return () => clearInterval(timer)
    }, [sessionId, cursor, fetchQueue])

    // Auto-scroll
    useEffect(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length])

    const formatTime = (ts) => {
        if (!ts) return ''
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    if (!sessionId) {
        return (
            <div className="kb-queue-feed">
                <div className="kb-queue-empty">
                    No active agent session. Send a message to start one.
                </div>
            </div>
        )
    }

    return (
        <div className="kb-queue-feed">
            {/* Agent status bar */}
            {agents.length > 0 && (
                <div className="kb-queue-agents">
                    {agents.map(a => (
                        <div key={a.agentId} className="kb-queue-agent-chip">
                            <span className="kb-queue-agent-status">{STATUS_ICONS[a.status] || '⚪'}</span>
                            <span className="kb-queue-agent-id">{a.agentId}</span>
                            <span className="kb-queue-agent-type">{a.type}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Message feed */}
            <div className="kb-queue-messages">
                {loading && messages.length === 0 && (
                    <div className="kb-queue-empty">Loading queue…</div>
                )}
                {!loading && messages.length === 0 && !error && (
                    <div className="kb-queue-empty">
                        No agent activity yet. Messages will appear here as the agent works.
                    </div>
                )}
                {error && (
                    <div className="kb-queue-error">⚠ {error}</div>
                )}

                {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`kb-queue-msg kb-queue-msg--${msg.direction}`}>
                        <div className="kb-queue-msg-header">
                            <span className="kb-queue-msg-direction">{DIRECTION_ICONS[msg.direction] || '•'}</span>
                            <span className="kb-queue-msg-agent">{msg.from || msg.agentId}</span>
                            <span className="kb-queue-msg-time">{formatTime(msg.timestamp)}</span>
                        </div>
                        <div className="kb-queue-msg-content">
                            {typeof msg.content === 'string'
                                ? msg.content
                                : JSON.stringify(msg.content, null, 2)
                            }
                        </div>
                    </div>
                ))}

                <div ref={feedEndRef} />
            </div>
        </div>
    )
}
