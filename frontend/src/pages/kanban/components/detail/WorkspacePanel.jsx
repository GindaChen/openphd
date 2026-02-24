import { useState, useRef, useEffect } from 'react'
import { useKanban } from '../../store/kanbanData'
import { apiFetch, apiStreamFetch } from '../../store/api'
import { renderMarkdown } from '../../utils/renderMarkdown'

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
}

const WORKSPACE_COLORS = ['#E8590C', '#D9480F', '#5C940D', '#1971C2', '#6741D9', '#C2255C', '#0B7285']

export default function WorkspacePanel({ issue, activeWorkspace, onSelectWorkspace, onClose }) {
    const { actions } = useKanban()
    const [chatInput, setChatInput] = useState('')
    const [thinking, setThinking] = useState(false)
    const chatEndRef = useRef(null)

    const workspaces = issue.workspaces || []
    const ws = activeWorkspace ? workspaces.find(w => w.id === activeWorkspace) : null

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [ws?.chatMessages?.length, thinking])

    const handleAddWorkspace = async () => {
        try {
            // Auto-create agent — backend generates a human-readable name
            const agentConfig = await apiFetch('/agents/create', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'workspace',
                    workspace: `issue-${issue.id}`,
                }),
            })

            const color = WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length]
            const newWs = {
                id: `w${Date.now()}`,
                name: agentConfig.displayName || agentConfig.agentId,
                agentId: agentConfig.agentId,
                status: 'active',
                color,
                branch: null,
                chatMessages: [],
                createdAt: new Date().toISOString(),
            }
            const updated = [...workspaces, newWs]
            await actions.updateIssue(issue.id, { workspaces: updated })
        } catch (err) {
            console.error('Failed to create workspace agent:', err)
            alert(`Could not create agent: ${err.message}`)
        }
    }

    const handleDeleteWorkspace = async (wsId) => {
        if (!confirm('Delete this workspace?')) return
        const updated = workspaces.filter(w => w.id !== wsId)
        await actions.updateIssue(issue.id, { workspaces: updated })
        if (activeWorkspace === wsId) onSelectWorkspace(null)
    }

    const handleSendChat = async () => {
        if (!chatInput.trim() || !ws || thinking) return
        const msg = chatInput.trim()
        setChatInput('')

        // Add user message immediately
        const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() }
        const updatedWs = workspaces.map(w => {
            if (w.id !== ws.id) return w
            return { ...w, chatMessages: [...(w.chatMessages || []), userMsg] }
        })
        await actions.updateIssue(issue.id, { workspaces: updatedWs })

        setThinking(true)
        let reply = ''

        try {
            if (ws.agentId) {
                // Use SSE streaming via the agent system
                const res = await apiStreamFetch('/agents/chat/stream', {
                    method: 'POST',
                    body: JSON.stringify({
                        message: msg,
                        sessionId: ws.agentId,
                    }),
                })

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })

                    const lines = buffer.split('\n')
                    buffer = lines.pop()

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        try {
                            const payload = JSON.parse(line.slice(6))
                            if (payload.content) reply += payload.content
                        } catch { }
                    }
                }
            } else {
                // Fallback for workspaces without an agentId
                const history = [...(ws.chatMessages || []), userMsg].map(m => ({
                    role: m.role, content: m.content,
                }))
                const result = await apiFetch('/workspace/chat', {
                    method: 'POST',
                    body: JSON.stringify({
                        issueId: issue.id,
                        workspaceId: ws.id,
                        messages: history,
                    }),
                })
                reply = result.content || result.error || 'No response from agent.'
            }

            if (!reply) reply = 'Done.'
        } catch (err) {
            reply = `⚠ ${err.message.includes('400') ? 'No API key configured. Set it in Settings → AI.' : err.message}`
        }
        setThinking(false)

        // Add assistant response
        const freshIssue = await actions.updateIssue(issue.id, {}) // re-fetch latest
        const latestWs = (freshIssue.workspaces || []).map(w => {
            if (w.id !== ws.id) return w
            return {
                ...w,
                chatMessages: [...(w.chatMessages || []), {
                    role: 'assistant',
                    content: reply,
                    timestamp: new Date().toISOString(),
                }],
            }
        })
        await actions.updateIssue(issue.id, { workspaces: latestWs })
    }

    // ── Workspace list view (no workspace selected) ──
    if (!ws) {
        return (
            <div className="kb-detail-section">
                <div className="kb-ws-header">
                    {/* <h3 className="kb-detail-section-title">🔀 Workspaces</h3> */}
                    <button className="kb-ws-add" onClick={handleAddWorkspace} title="Add workspace">+</button>
                </div>
                {workspaces.length === 0 && (
                    <div className="kb-ws-empty">No workspaces yet. Click + to create one.</div>
                )}
                <div className="kb-ws-list">
                    {workspaces.map(w => (
                        <div key={w.id} className="kb-ws-item" onClick={() => onSelectWorkspace(w.id)}>
                            <div className="kb-ws-item-left">
                                <span className="kb-ws-dot" style={{ background: w.color }} />
                                <div className="kb-ws-item-info">
                                    <span className="kb-ws-item-name">{w.name}</span>
                                    <span className="kb-ws-item-meta">
                                        {w.status === 'active' ? '● Active' : '○ Inactive'} · {formatRelative(w.createdAt)}
                                    </span>
                                </div>
                            </div>
                            <div className="kb-ws-item-actions">
                                <button className="kb-ws-agent-icon" title="Agent session">🤖</button>
                                <button
                                    className="kb-ws-delete"
                                    onClick={e => { e.stopPropagation(); handleDeleteWorkspace(w.id) }}
                                    title="Delete workspace"
                                >×</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // ── Chat view for selected workspace ──
    return (
        <div className="kb-ws-chat-panel">
            <div className="kb-ws-chat-header">
                <button className="kb-ws-back" onClick={() => onSelectWorkspace(null)}>←</button>
                <span className="kb-ws-dot" style={{ background: ws.color }} />
                <span className="kb-ws-chat-title">{ws.name}</span>
                <span className="kb-ws-chat-status">{ws.status}</span>
            </div>

            <div className="kb-ws-chat-messages">
                {(!ws.chatMessages || ws.chatMessages.length === 0) && (
                    <div className="kb-chat-empty">Start a conversation in this workspace</div>
                )}
                {ws.chatMessages?.map((msg, idx) => (
                    <div key={idx} className={`kb-chat-msg kb-chat-msg--${msg.role}`}>
                        <div className="kb-chat-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                        <div className="kb-chat-bubble">
                            <div className="kb-chat-meta">
                                <span className="kb-chat-role">{msg.role === 'user' ? 'You' : 'Agent'}</span>
                                <span className="kb-chat-time">{formatTime(msg.timestamp)}</span>
                            </div>
                            <div className="kb-chat-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        </div>
                    </div>
                ))}
                {thinking && (
                    <div className="kb-chat-msg kb-chat-msg--assistant">
                        <div className="kb-chat-avatar">🤖</div>
                        <div className="kb-chat-bubble">
                            <div className="kb-chat-meta">
                                <span className="kb-chat-role">Agent</span>
                                <span className="kb-chat-time">thinking…</span>
                            </div>
                            <div className="kb-chat-text" style={{ opacity: 0.5 }}>
                                <span className="kb-thinking-dots">●●●</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="kb-chat-input-row">
                <input
                    className="kb-chat-input"
                    placeholder={thinking ? 'Agent is thinking...' : `Message ${ws.name}...`}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                    disabled={thinking}
                    autoFocus
                />
                <button className="kb-chat-send" onClick={handleSendChat} disabled={!chatInput.trim() || thinking}>
                    {thinking ? '⏳' : 'Send'}
                </button>
            </div>
        </div>
    )
}
