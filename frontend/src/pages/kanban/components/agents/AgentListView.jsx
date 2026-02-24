import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiFetch, apiStreamFetch } from '../../store/api'
import { useResizable } from '../../hooks/useResizable'
import { renderMarkdown } from '../../lib/markdown'
import ToolChip from '../chat/ToolChip'

// ─────────────────────────────────────────────────────────
// AgentListView — Multi-agent grid
//
// Left: collapsible agent list (compact)
// Right: grid of open agent chat panels
// ─────────────────────────────────────────────────────────

const STATUS_COLOR = { created: '#667eea', running: '#4ade80', stopped: '#666', idle: '#fbbf24', error: '#f87171' }

function fmtTime(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ── Agent Row (compact, clickable to open in grid) ──

function AgentRow({ agent, isOpen, onToggle, indent = 0 }) {
    return (
        <button
            className={`ag-row ${isOpen ? 'ag-row--open' : ''}`}
            onClick={() => onToggle(agent.agentId)}
            style={{ paddingLeft: `${8 + indent * 14}px` }}
        >
            <span className="ag-row-dot" style={{ background: STATUS_COLOR[agent.status] || '#666' }} />
            <span className="ag-row-name">{agent.displayName || agent.agentId}</span>
            {agent.type === 'master' && <span className="ag-row-badge">M</span>}
            {isOpen && <span className="ag-row-open-indicator">●</span>}
        </button>
    )
}

// ── Single Agent Chat Box (used inside the grid) ──

function AgentChatBox({ agent, onClose }) {
    const [messages, setMessages] = useState([])
    const [historyLoaded, setHistoryLoaded] = useState(false)

    // Load persisted chat history on mount
    useEffect(() => {
        let cancelled = false
        apiFetch(`/agents/detail/${agent.agentId}/history`)
            .then(history => {
                if (cancelled || !Array.isArray(history)) return
                setMessages(history.map(m => ({
                    role: m.role,
                    content: m.content,
                    ts: m.timestamp,
                    thinking: m.thinking || null,
                    toolCalls: m.toolCalls || null,
                })))
                setHistoryLoaded(true)
            })
            .catch(() => setHistoryLoaded(true))
        return () => { cancelled = true }
    }, [agent.agentId])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [streamingThinking, setStreamingThinking] = useState('')
    const [streamingTools, setStreamingTools] = useState([])
    const chatEndRef = useRef(null)
    const messagesRef = useRef(null)
    const inputRef = useRef(null)
    const userScrolledUp = useRef(false)

    // Track whether user has scrolled away from bottom
    useEffect(() => {
        const el = messagesRef.current
        if (!el) return
        const onScroll = () => {
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
            userScrolledUp.current = distFromBottom > 80
        }
        el.addEventListener('scroll', onScroll)
        return () => el.removeEventListener('scroll', onScroll)
    }, [])

    // Auto-scroll only if user is near the bottom
    useEffect(() => {
        if (!userScrolledUp.current) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages.length, streamingContent])

    const handleSend = useCallback(async () => {
        if (!input.trim() || sending) return
        const text = input.trim()
        setMessages(prev => [...prev, { role: 'user', content: text, ts: new Date().toISOString() }])
        setInput('')
        setSending(true)
        setStreamingContent('')
        setStreamingThinking('')
        setStreamingTools([])

        try {
            const body = { message: text, sessionId: agent.agentId }
            const res = await apiStreamFetch('/agents/chat/stream', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullContent = ''
            const toolResults = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()

                let eventType = null
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7)
                    } else if (line.startsWith('data: ') && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            switch (eventType) {
                                case 'thinking_start': setStreamingThinking(''); break
                                case 'thinking_delta': if (data.text) setStreamingThinking(prev => prev + data.text); break
                                case 'content': if (data.text) { fullContent += data.text; setStreamingContent(fullContent) } break
                                case 'tool_start':
                                    toolResults.push({ tool: data.toolName, args: data.args, result: null })
                                    setStreamingTools([...toolResults])
                                    break
                                case 'tool_end': {
                                    const last = toolResults.findLast(t => t.tool === data.toolName)
                                    if (last) last.result = { output: data.result }
                                    setStreamingTools([...toolResults])
                                    break
                                }
                                case 'message':
                                    fullContent = data.content || fullContent
                                    setStreamingContent(fullContent)
                                    break
                                case 'error':
                                    fullContent += `\n❌ ${data.message}`
                                    setStreamingContent(fullContent)
                                    break
                            }
                        } catch { }
                        eventType = null
                    }
                }
            }

            setMessages(prev => [...prev, {
                role: 'assistant', content: fullContent || 'Done!',
                toolCalls: toolResults.length > 0 ? toolResults : undefined,
                ts: new Date().toISOString(),
            }])
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.message}`, ts: new Date().toISOString() }])
        } finally {
            setStreamingContent('')
            setStreamingThinking('')
            setStreamingTools([])
            setSending(false)
        }
    }, [input, sending, agent.agentId])

    return (
        <div className="ag-box">
            <div className="ag-box-header">
                <span className="ag-box-dot" style={{ background: STATUS_COLOR[agent.status] || '#666' }} />
                <span className="ag-box-name">{agent.displayName || agent.agentId}</span>
                {agent.type === 'master' && <span className="ag-row-badge">M</span>}
                <span className="ag-box-model">{agent.model || ''}</span>
                <button className="ag-box-close" onClick={onClose} title="Close">×</button>
            </div>

            <div className="ag-box-messages" ref={messagesRef}>
                {messages.length === 0 && !streamingContent && !streamingThinking && (
                    <div className="ag-box-welcome">Chat with <strong>{agent.displayName}</strong></div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`ag-msg ag-msg--${msg.role}`}>
                        <span className="ag-msg-avatar">{msg.role === 'user' ? '👤' : '🤖'}</span>
                        <div className="ag-msg-body">
                            {msg.thinking && (
                                <details className="kb-ask-thinking">
                                    <summary>💭 Thinking</summary>
                                    <div className="kb-ask-thinking-text">{msg.thinking}</div>
                                </details>
                            )}
                            {msg.toolCalls?.map((tc, j) => (
                                <ToolChip key={j} tool={tc.tool} args={tc.args} result={tc.result && typeof tc.result === 'string' ? { output: tc.result } : tc.result} />
                            ))}
                            <div className="ag-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        </div>
                    </div>
                ))}

                {/* Streaming */}
                {(streamingContent || streamingThinking || streamingTools.length > 0) && (
                    <div className="ag-msg ag-msg--assistant ag-msg--streaming">
                        <span className="ag-msg-avatar">🤖</span>
                        <div className="ag-msg-body">
                            {streamingThinking && (
                                <details className="kb-ask-thinking" open={!streamingContent}>
                                    <summary>💭 Thinking</summary>
                                    <div className="kb-ask-thinking-text">{streamingThinking}</div>
                                </details>
                            )}
                            {streamingTools.map((tc, j) => (
                                <ToolChip key={j} tool={tc.tool} args={tc.args} result={tc.result} />
                            ))}
                            {streamingContent && (
                                <div className="ag-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                            )}
                        </div>
                    </div>
                )}

                {sending && !streamingContent && !streamingThinking && streamingTools.length === 0 && (
                    <div className="ag-msg ag-msg--assistant">
                        <span className="ag-msg-avatar">🤖</span>
                        <div className="ag-msg-body"><span className="ag-msg-typing">Thinking…</span></div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="ag-box-input-row">
                <input
                    ref={inputRef}
                    className="ag-box-input"
                    placeholder={`Message ${agent.displayName}…`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={sending}
                />
                <button className="ag-box-send" onClick={handleSend} disabled={!input.trim() || sending}>
                    {sending ? '⏳' : '↗'}
                </button>
            </div>
        </div>
    )
}

// ── Main View ──

export default function AgentListView() {
    const [agents, setAgents] = useState([])
    const [loading, setLoading] = useState(true)
    const [openIds, setOpenIds] = useState([])         // IDs of agents open in grid
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [viewMode, setViewMode] = useState('flat')
    const containerRef = useRef(null)

    const { width: sidebarWidth, handleMouseDown: sidebarResizeDown } = useResizable({
        percentBased: true,
        containerRef,
        minPercent: 15,
        maxPercent: 60,
        initialPercent: 25,
        storageKey: 'ag-sidebar-pct',
    })

    const loadAgents = useCallback(async () => {
        try {
            setLoading(true)
            const data = await apiFetch('/agents/list')
            setAgents(Array.isArray(data) ? data : [])
        } catch { }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadAgents() }, [loadAgents])

    const toggleAgent = (id) => {
        setOpenIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const closeAgent = (id) => setOpenIds(prev => prev.filter(x => x !== id))

    const openAgents = useMemo(() =>
        openIds.map(id => agents.find(a => a.agentId === id)).filter(Boolean),
        [openIds, agents]
    )

    // Tree grouping
    const roots = agents.filter(a => !a.parentId)
    const childMap = {}
    agents.forEach(a => { if (a.parentId) { (childMap[a.parentId] ??= []).push(a) } })

    const renderTree = (agent, depth = 0) => (
        <div key={agent.agentId}>
            <AgentRow agent={agent} isOpen={openIds.includes(agent.agentId)} onToggle={toggleAgent} indent={depth} />
            {childMap[agent.agentId]?.map(c => renderTree(c, depth + 1))}
        </div>
    )

    // Determine grid layout: 1 col for 1, 2 cols for 2-4, 3 cols for 5+
    const gridCols = openAgents.length <= 1 ? 1 : openAgents.length <= 4 ? 2 : 3

    return (
        <div className="ag-view" ref={containerRef}>
            {/* Header */}
            <div className="ag-view-header">
                <button className="ag-collapse-btn" onClick={() => setSidebarCollapsed(c => !c)} title={sidebarCollapsed ? 'Show list' : 'Hide list'}>
                    {sidebarCollapsed ? '▸' : '◂'}
                </button>
                <span className="ag-view-title">🤖 Agents</span>
                <span className="ag-view-count">{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
                {openAgents.length > 0 && (
                    <span className="ag-view-open-count">{openAgents.length} open</span>
                )}
            </div>

            <div className="ag-view-body">
                {/* Left: agent list */}
                {!sidebarCollapsed && (
                    <div className="ag-view-left" style={{ width: sidebarWidth }}>
                        <div className="ag-sidebar">
                            <div className="ag-sidebar-header">
                                <div className="ag-sidebar-view-toggle">
                                    <button className={`ag-view-btn ${viewMode === 'flat' ? 'ag-view-btn--active' : ''}`} onClick={() => setViewMode('flat')} title="Flat">☰</button>
                                    <button className={`ag-view-btn ${viewMode === 'tree' ? 'ag-view-btn--active' : ''}`} onClick={() => setViewMode('tree')} title="Tree">🌿</button>
                                </div>
                                <button className="ag-refresh-btn" onClick={loadAgents} title="Refresh">↻</button>
                            </div>
                            <div className="ag-sidebar-list">
                                {loading && <div className="ag-sidebar-empty">Loading…</div>}
                                {!loading && agents.length === 0 && (
                                    <div className="ag-sidebar-empty">No agents yet.<br /><span className="ag-sidebar-empty-hint">Start a chat to create one.</span></div>
                                )}
                                {viewMode === 'flat'
                                    ? agents.map(a => <AgentRow key={a.agentId} agent={a} isOpen={openIds.includes(a.agentId)} onToggle={toggleAgent} />)
                                    : roots.map(a => renderTree(a))
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Resize handle */}
                {!sidebarCollapsed && (
                    <div className="ag-view-resize" onMouseDown={sidebarResizeDown} />
                )}

                {/* Right: agent grid */}
                <div className="ag-view-right">
                    {openAgents.length === 0 ? (
                        <div className="ag-grid-empty">
                            <span className="ag-grid-empty-icon">🤖</span>
                            <p>Click an agent on the left to open it here</p>
                            <p className="ag-grid-empty-hint">You can open multiple agents at once</p>
                        </div>
                    ) : (
                        <div className="ag-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                            {openAgents.map(agent => (
                                <AgentChatBox key={agent.agentId} agent={agent} onClose={() => closeAgent(agent.agentId)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
