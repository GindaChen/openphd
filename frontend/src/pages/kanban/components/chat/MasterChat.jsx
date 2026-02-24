import { useState, useRef, useEffect, useCallback } from 'react'
import { useKanban } from '../../store/kanbanData'
import { apiFetch, apiStreamFetch } from '../../store/api'
import { loadSettings } from '../../store/settings'
import { renderMarkdown } from '../../lib/markdown'
import ToolChip from './ToolChip'
import PromptDebug from './PromptDebug'
import AgentQueueFeed from './AgentQueueFeed'

// ─────────────────────────────────────────────────────────
// MasterChat — agent-first chat panel
//
// All messages go to the pi-mono Master Agent via SSE.
// If the agent isn't configured, the panel shows an
// onboarding message. No local command parsing, no LLM
// fallback — the agent IS the interface.
// ─────────────────────────────────────────────────────────

export default function MasterChat({ isOpen, onToggle, fullScreen }) {
    const { state, actions } = useKanban()

    // ── State ──
    const [input, setInput] = useState('')
    const [agentStatus, setAgentStatus] = useState(null)
    const [sending, setSending] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [streamingThinking, setStreamingThinking] = useState('')
    const [streamingTools, setStreamingTools] = useState([])
    const [activeTab, setActiveTab] = useState('chat')
    const [debugMode, setDebugMode] = useState(false)

    // ── Refs ──
    const chatEndRef = useRef(null)
    const inputRef = useRef(null)
    const sessionIdRef = useRef(localStorage.getItem('agent-session-id') || null)
    const pendingAgentMsgRef = useRef(null)
    const lastDebugRef = useRef(null)

    // ── Auto-scroll ──
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [state.masterChat.length, streamingContent])

    // ── Check agent status on mount ──
    useEffect(() => {
        apiFetch('/agents/status').then(setAgentStatus).catch(() => setAgentStatus(null))
    }, [])

    // ── SSE stream from pi-mono Master Agent ──
    const streamFromAgent = useCallback(async (text) => {
        setStreamingContent('')
        setStreamingThinking('')
        setStreamingTools([])

        try {
            const body = { message: text }
            if (sessionIdRef.current) body.sessionId = sessionIdRef.current

            const res = await apiStreamFetch('/agents/chat/stream', {
                method: 'POST',
                body: JSON.stringify(body),
            })

            const hdrSession = res.headers.get('X-Session-Id')
            if (hdrSession) sessionIdRef.current = hdrSession

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
                                case 'session':
                                    sessionIdRef.current = data.sessionId
                                    try { localStorage.setItem('agent-session-id', data.sessionId) } catch { }
                                    break
                                case 'prompt_debug':
                                    lastDebugRef.current = data
                                    break
                                case 'thinking_start':
                                    setStreamingThinking('')
                                    break
                                case 'thinking':
                                    // Streaming thinking delta from agent
                                    if (data.text) {
                                        setStreamingThinking(prev => prev + data.text)
                                    }
                                    break
                                case 'thinking_end':
                                    // Keep final thinking text visible until response starts
                                    break
                                case 'content':
                                    // Streaming text delta from agent
                                    if (data.text) {
                                        fullContent += data.text
                                        setStreamingContent(fullContent)
                                    }
                                    break
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
                                    // Final complete message — overwrite any streamed content
                                    fullContent = data.content || fullContent
                                    setStreamingContent(fullContent)
                                    break
                                case 'error':
                                    fullContent += `\n❌ Error: ${data.message}`
                                    setStreamingContent(fullContent)
                                    break
                            }
                        } catch { }
                        eventType = null
                    }
                }
            }

            const toolCalls = toolResults.length > 0 ? toolResults : undefined
            const debugInfo = lastDebugRef.current
            actions.addMasterChat('assistant', fullContent || 'Done!', toolCalls, debugInfo)
            lastDebugRef.current = null
            setStreamingContent('')
            setStreamingThinking('')
            setStreamingTools([])
            await actions.loadBoard()
        } catch (err) {
            actions.addMasterChat('assistant', `❌ Agent error: ${err.message}`)
            lastDebugRef.current = null
            setStreamingContent('')
            setStreamingThinking('')
            setStreamingTools([])
        }
    }, [actions])

    // ── Send handler ──
    const handleSend = useCallback(async () => {
        if (!input.trim() || sending) return
        const text = input.trim()
        actions.addMasterChat('user', text)
        setInput('')
        setSending(true)

        try {
            if (text.toLowerCase() === 'clear') {
                await actions.clearChatHistory()
                return
            }
            const settings = loadSettings()
            const isConfigured = agentStatus?.configured || !!settings.llmApiKey
            if (isConfigured) {
                await streamFromAgent(text)
            } else {
                actions.addMasterChat('assistant',
                    'Agent not configured. Set your API key in **Settings** (⚙) or via the onboarding wizard to enable the Master Agent.')
            }
        } finally {
            setSending(false)
        }
    }, [input, sending, actions, agentStatus, streamFromAgent])

    // ── Command K integration ──
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail?.message
            if (msg) {
                pendingAgentMsgRef.current = msg
                setInput(msg)
            }
        }
        window.addEventListener('kb-agent-send', handler)
        return () => window.removeEventListener('kb-agent-send', handler)
    }, [])

    useEffect(() => {
        if (pendingAgentMsgRef.current && input === pendingAgentMsgRef.current && !sending) {
            pendingAgentMsgRef.current = null
            handleSend()
        }
    }, [input, sending, handleSend])

    // ── Helpers ──
    const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

    const settings = loadSettings()
    const isConfigured = agentStatus?.configured || !!settings.llmApiKey



    // ── Render ──
    return (
        <div className={`kb-ask-panel ${isOpen ? 'kb-ask-panel--open' : 'kb-ask-panel--collapsed'} ${fullScreen ? 'kb-ask-panel--fullscreen' : ''}`}>
            {!isOpen && (
                <button className="kb-ask-toggle" onClick={onToggle}>
                    <span className="kb-ask-toggle-icon">✨</span>
                    <span className="kb-ask-toggle-label">Ask</span>
                </button>
            )}

            {isOpen && (
                <>
                    <div className="kb-ask-header">
                        <div className="kb-ask-header-left">
                            <span className="kb-ask-header-icon">✨</span>
                            <span className="kb-ask-header-title">Ask</span>

                        </div>
                        <div className="kb-ask-header-tabs">
                            <button
                                className={`kb-ask-tab ${activeTab === 'chat' ? 'kb-ask-tab--active' : ''}`}
                                onClick={() => setActiveTab('chat')}
                            >Chat</button>
                            <button
                                className={`kb-ask-tab ${activeTab === 'activity' ? 'kb-ask-tab--active' : ''}`}
                                onClick={() => setActiveTab('activity')}
                            >Activity</button>
                        </div>
                        <div className="kb-ask-header-right">
                            <button
                                className={`kb-ask-debug-btn ${debugMode ? 'kb-ask-debug-btn--active' : ''}`}
                                onClick={() => setDebugMode(d => !d)}
                                title={debugMode ? 'Hide prompt debug info' : 'Show prompt debug info'}
                            >{debugMode ? '🔍' : '🔎'}</button>
                            <button
                                className="kb-ask-clear-btn"
                                onClick={() => actions.clearChatHistory()}
                                title="Clear chat history"
                            >🗑</button>
                            <button className="kb-ask-collapse" onClick={onToggle}>◀</button>
                        </div>
                    </div>

                    {activeTab === 'activity' ? (
                        <AgentQueueFeed sessionId={sessionIdRef.current} />
                    ) : (
                        <>
                            <div className="kb-ask-messages">
                                {state.masterChat.length === 0 && !streamingContent && (
                                    <div className="kb-ask-welcome">
                                        <span className="kb-ask-welcome-icon">✨</span>
                                        <p>Hi! I'm your Master Agent.</p>
                                        <p className="kb-ask-welcome-hint">
                                            {isConfigured
                                                ? 'I can create issues, manage the board, spawn workers, and coordinate your research. Ask me anything!'
                                                : 'Set your API key in Settings (⚙) to enable me.'}
                                        </p>
                                    </div>
                                )}

                                {state.masterChat.map((msg, idx) => (
                                    <div key={idx} className={`kb-ask-msg kb-ask-msg--${msg.role}`}>
                                        <div className="kb-ask-msg-avatar">{msg.role === 'user' ? '👤' : '✨'}</div>
                                        <div className="kb-ask-msg-body">
                                            <div className="kb-ask-msg-meta">
                                                <span>{msg.role === 'user' ? 'You' : 'Agent'}</span>
                                                <span className="kb-ask-msg-time">{formatTime(msg.timestamp)}</span>
                                            </div>
                                            {debugMode && msg.role === 'assistant' && msg.debugInfo && (
                                                <PromptDebug debug={msg.debugInfo} />
                                            )}
                                            {msg.toolCalls?.length > 0 && (
                                                <div className="kb-ask-tool-chips">
                                                    {msg.toolCalls.map((tc, i) => (
                                                        <ToolChip key={i} tool={tc.tool} args={tc.args} result={tc.result} />
                                                    ))}
                                                </div>
                                            )}
                                            <div className="kb-ask-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                        </div>
                                    </div>
                                ))}

                                {/* Streaming in-progress */}
                                {(streamingContent || streamingThinking || streamingTools.length > 0) && (
                                    <div className="kb-ask-msg kb-ask-msg--assistant kb-ask-msg--streaming">
                                        <div className="kb-ask-msg-avatar">✨</div>
                                        <div className="kb-ask-msg-body">
                                            <div className="kb-ask-msg-meta">
                                                <span>Agent</span>
                                                <span className="kb-ask-msg-time kb-ask-streaming-indicator">
                                                    ● {streamingThinking && !streamingContent ? 'thinking' : 'streaming'}
                                                </span>
                                            </div>
                                            {streamingThinking && (
                                                <details className="kb-ask-thinking" open={!streamingContent}>
                                                    <summary>💭 Thinking</summary>
                                                    <div className="kb-ask-thinking-text">{streamingThinking}</div>
                                                </details>
                                            )}
                                            {streamingTools.length > 0 && (
                                                <div className="kb-ask-tool-chips">
                                                    {streamingTools.map((tc, i) => (
                                                        <ToolChip key={i} tool={tc.tool} args={tc.args} result={tc.result} />
                                                    ))}
                                                </div>
                                            )}
                                            {streamingContent && (
                                                <div className="kb-ask-msg-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {sending && !streamingContent && !streamingThinking && streamingTools.length === 0 && (
                                    <div className="kb-ask-msg kb-ask-msg--assistant">
                                        <div className="kb-ask-msg-avatar">✨</div>
                                        <div className="kb-ask-msg-body">
                                            <div className="kb-ask-msg-text kb-ask-typing">Thinking...</div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            <div className="kb-ask-input-row">
                                <input
                                    ref={inputRef}
                                    className="kb-ask-input"
                                    placeholder="Ask anything..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    disabled={sending}
                                    autoFocus
                                />
                                <button className="kb-ask-send" onClick={handleSend} disabled={!input.trim() || sending}>
                                    {sending ? '⏳' : '↗'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    )
}
