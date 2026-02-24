import { useState, useRef, useEffect, useCallback } from 'react'
import { useKanban, COLUMNS, getLabelColor } from '../../store/kanbanData'
import { useResizable } from '../../hooks/useResizable'
import CollapsibleSection from './CollapsibleSection'
import IssueBody from './IssueBody'
import ArtifactList from './ArtifactList'
import RelationshipList from './RelationshipList'
import IssueChat from './IssueChat'
import IssueSidebar from './IssueSidebar'
import WorkspacePanel from './WorkspacePanel'
import { apiFetch } from '../../store/api'

export default function IssueDetailPanel({ issue, onClose, onUpdateIssue }) {
    const { state, actions } = useKanban()

    // Keyboard navigation for collapsible sections
    useEffect(() => {
        const handler = (e) => {
            // Only fire when not in input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return

            const sections = Array.from(document.querySelectorAll('.kb-detail .kb-collapsible-header'))
            if (sections.length === 0) return

            const focused = document.querySelector('.kb-collapsible-header.kb-section--focused')
            const currentIdx = focused ? sections.indexOf(focused) : -1

            const clearSectionFocus = () => {
                sections.forEach(s => s.classList.remove('kb-section--focused'))
            }

            const setSectionFocus = (idx) => {
                clearSectionFocus()
                if (idx >= 0 && idx < sections.length) {
                    sections[idx].classList.add('kb-section--focused')
                    sections[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                }
            }

            if (e.key === 'j' || (e.key === 'ArrowDown' && !e.metaKey && !e.ctrlKey)) {
                // Check if we're inside the detail panel
                const detailEl = document.querySelector('.kb-detail')
                if (!detailEl) return
                e.preventDefault()
                if (currentIdx < 0) {
                    setSectionFocus(0)
                } else {
                    setSectionFocus(Math.min(currentIdx + 1, sections.length - 1))
                }
                return
            }

            if (e.key === 'k' || (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey)) {
                const detailEl = document.querySelector('.kb-detail')
                if (!detailEl) return
                e.preventDefault()
                if (currentIdx < 0) {
                    setSectionFocus(0)
                } else {
                    setSectionFocus(Math.max(currentIdx - 1, 0))
                }
                return
            }

            if (e.key === 'Enter' && focused) {
                e.preventDefault()
                focused.click()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])
    const [activeWorkspace, setActiveWorkspace] = useState(null)
    const [expandedWs, setExpandedWs] = useState(null)  // workspace expanded into left panel
    const [wsChatInput, setWsChatInput] = useState('')
    const [wsChatMessages, setWsChatMessages] = useState([])  // local chat for expanded panel
    const [wsThinking, setWsThinking] = useState(false)
    const [editingTitle, setEditingTitle] = useState(false)
    const [titleValue, setTitleValue] = useState('')
    const [jsonMode, setJsonMode] = useState(false)
    const [jsonValue, setJsonValue] = useState('')
    const [jsonError, setJsonError] = useState(null)
    const titleInputRef = useRef(null)
    const { width, handleMouseDown } = useResizable({
        initialWidth: 560,
        minWidth: 40,
        maxWidth: 4000,
        storageKey: 'kb-detail-width',
    })

    const liveIssue = state.issues.find(i => i.id === issue.id) || issue
    const columns = state.board?.columns || COLUMNS
    const boardLabels = state.board?.labels || {}

    // Focus title input when editing
    useEffect(() => {
        if (editingTitle && titleInputRef.current) {
            titleInputRef.current.focus()
            titleInputRef.current.select()
        }
    }, [editingTitle])

    // Human-only discussion — no AI auto-reply (#130)
    const handleSendChat = async (msg) => {
        await actions.addIssueChat(issue.id, 'user', msg)
    }

    const handleStatusChange = async (newStatus) => {
        await actions.moveIssue(issue.id, newStatus)
    }

    const handleTitleEdit = () => {
        setTitleValue(liveIssue.title)
        setEditingTitle(true)
    }

    const handleTitleSave = async () => {
        const trimmed = titleValue.trim()
        if (trimmed && trimmed !== liveIssue.title) {
            await actions.updateIssue(issue.id, { title: trimmed })
        }
        setEditingTitle(false)
    }

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') handleTitleSave()
        if (e.key === 'Escape') setEditingTitle(false)
    }

    // JSON editor
    const handleJsonToggle = () => {
        if (!jsonMode) {
            setJsonValue(JSON.stringify(liveIssue, null, 2))
            setJsonError(null)
        }
        setJsonMode(!jsonMode)
    }

    const handleJsonSave = async () => {
        try {
            const parsed = JSON.parse(jsonValue)
            setJsonError(null)
            // Only send editable fields
            const { id, ...updates } = parsed
            await actions.updateIssue(issue.id, updates)
            setJsonMode(false)
        } catch (err) {
            setJsonError(err.message)
        }
    }

    // Contextual info section
    const contextEntries = liveIssue.contextualInfo ? Object.entries(liveIssue.contextualInfo) : []

    // When a workspace is selected, expand it into the left panel
    const handleWorkspaceExpand = useCallback((wsId) => {
        setActiveWorkspace(wsId)
        if (wsId) {
            const ws = (liveIssue.workspaces || []).find(w => w.id === wsId)
            setExpandedWs(ws || null)
            // Load chat history from workspace
            setWsChatMessages((ws?.chatMessages || []).map(m => ({ role: m.role, content: m.content })))
        } else {
            setExpandedWs(null)
            setWsChatMessages([])
        }
    }, [liveIssue.workspaces])

    // Simple markdown renderer (matches MasterChat)
    const renderMarkdown = (text) => {
        return (text || '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code class="kb-md-code">$1</code>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>')
    }

    // Keep a ref to latest messages so streaming callbacks don't stale-close
    const wsChatMessagesRef = useRef(wsChatMessages)
    useEffect(() => { wsChatMessagesRef.current = wsChatMessages }, [wsChatMessages])

    // Send chat message using streaming endpoint
    const handleWsChatSend = async () => {
        if (!wsChatInput.trim() || wsThinking) return
        const msg = wsChatInput.trim()
        setWsChatInput('')
        const userMsg = { role: 'user', content: msg }
        const updated = [...wsChatMessages, userMsg]
        setWsChatMessages(updated)

        // Persist user msg to workspace
        const workspace = (liveIssue.workspaces || []).map(w => {
            if (w.id !== expandedWs?.id) return w
            return { ...w, chatMessages: [...(w.chatMessages || []), { ...userMsg, timestamp: new Date().toISOString() }] }
        })
        await actions.updateIssue(issue.id, { workspaces: workspace })

        // Start streaming
        setWsThinking(true)
        const assistantIdx = updated.length // index where assistant msg will be

        // Add placeholder assistant message
        setWsChatMessages(prev => [...prev, { role: 'assistant', content: '' }])

        try {
            const settings = (await import('../../store/settings')).loadSettings()
            const headers = { 'Content-Type': 'application/json' }
            if (settings.llmApiKey) headers['X-LLM-API-Key'] = settings.llmApiKey
            if (settings.llmModel) headers['X-LLM-Model'] = settings.llmModel
            if (settings.llmBaseUrl) headers['X-LLM-Base-URL'] = settings.llmBaseUrl
            if (settings.projectRoot) headers['X-Project-Root'] = settings.projectRoot

            const res = await fetch('/api/kanban/chat/stream', {
                method: 'POST',
                headers,
                body: JSON.stringify({ messages: updated }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: res.statusText }))
                setWsChatMessages(prev => {
                    const copy = [...prev]
                    copy[assistantIdx] = { role: 'assistant', content: `⚠ ${err.error || 'Stream failed'}` }
                    return copy
                })
                setWsThinking(false)
                return
            }

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
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') continue
                    try {
                        const chunk = JSON.parse(data)
                        if (chunk.content) {
                            setWsChatMessages(prev => {
                                const copy = [...prev]
                                copy[assistantIdx] = {
                                    ...copy[assistantIdx],
                                    content: (copy[assistantIdx]?.content || '') + chunk.content,
                                }
                                return copy
                            })
                        }
                    } catch { }
                }
            }
        } catch (err) {
            setWsChatMessages(prev => {
                const copy = [...prev]
                copy[assistantIdx] = { role: 'assistant', content: `⚠ ${err.message}` }
                return copy
            })
        }

        setWsThinking(false)

        // Persist final assistant message to workspace
        const finalMessages = wsChatMessagesRef.current
        const finalContent = finalMessages[assistantIdx]?.content || ''
        const freshIssue = await actions.updateIssue(issue.id, {})
        const ws2 = (freshIssue.workspaces || []).map(w => {
            if (w.id !== expandedWs?.id) return w
            return { ...w, chatMessages: [...(w.chatMessages || []), { role: 'assistant', content: finalContent, timestamp: new Date().toISOString() }] }
        })
        await actions.updateIssue(issue.id, { workspaces: ws2 })
    }

    return (
        <>
            {/* Expanded workspace chat panel — renders LEFT of the detail panel */}
            {expandedWs && (
                <div className="kb-ws-expanded-panel">
                    <div className="kb-ws-expanded-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                            <span className="kb-ws-dot" style={{ background: expandedWs.color }} />
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>{expandedWs.name}</span>
                            <span style={{ fontSize: '10px', opacity: 0.5 }}>#{liveIssue.ghId || liveIssue.id}</span>
                        </div>
                        <button className="kb-detail-close" onClick={() => handleWorkspaceExpand(null)}>✕</button>
                    </div>
                    <div className="kb-ws-expanded-messages">
                        {wsChatMessages.length === 0 && (
                            <div className="kb-chat-empty">Send a message to start chatting about this issue</div>
                        )}
                        {wsChatMessages.map((msg, idx) => (
                            <div key={idx} className={`kb-chat-msg kb-chat-msg--${msg.role}`}>
                                <div className="kb-chat-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                                <div className="kb-chat-bubble">
                                    <div className="kb-chat-meta">
                                        <span className="kb-chat-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                                    </div>
                                    <div className="kb-chat-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                </div>
                            </div>
                        ))}
                        {wsThinking && (
                            <div className="kb-chat-msg kb-chat-msg--assistant">
                                <div className="kb-chat-avatar">🤖</div>
                                <div className="kb-chat-bubble">
                                    <div className="kb-chat-text" style={{ opacity: 0.5 }}>
                                        <span className="kb-thinking-dots">●●●</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="kb-chat-input-row" style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
                        <input
                            className="kb-chat-input"
                            placeholder={wsThinking ? 'Thinking...' : `Chat about ${liveIssue.title.slice(0, 30)}...`}
                            value={wsChatInput}
                            onChange={e => setWsChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleWsChatSend()}
                            disabled={wsThinking}
                            autoFocus
                        />
                        <button className="kb-chat-send" onClick={handleWsChatSend} disabled={!wsChatInput.trim() || wsThinking}>
                            {wsThinking ? '⏳' : 'Send'}
                        </button>
                    </div>
                </div>
            )}

            <div className="kb-detail-wrapper" style={{ width, flexShrink: 0 }}>
                {/* Resize handle */}
                <div className="kb-resize-handle" onMouseDown={handleMouseDown} />

                <div className="kb-detail">
                    {/* Header — compact: issue # + status/priority inline (#100) */}
                    <div className="kb-detail-header">
                        <div className="kb-detail-header-left">
                            {liveIssue.ghUrl ? (
                                <a href={liveIssue.ghUrl} target="_blank" rel="noopener noreferrer"
                                    className="kb-detail-number kb-card-gh-link"
                                    title={`View #${liveIssue.ghId} on GitHub`}>
                                    #{liveIssue.ghId}
                                </a>
                            ) : (
                                <span className="kb-detail-number">#{liveIssue.id}</span>
                            )}
                            <span style={{ fontSize: '14px', opacity: 0.5 }}>{liveIssue.title.length > 40 ? liveIssue.title.slice(0, 40) + '…' : liveIssue.title}</span>
                        </div>
                        <div className="kb-detail-header-actions">
                            <button
                                className={`kb-detail-json-toggle ${jsonMode ? 'kb-detail-json-toggle--active' : ''}`}
                                onClick={handleJsonToggle}
                                title="Toggle JSON editor"
                            >{'{}'}</button>
                            <button className="kb-detail-close" onClick={onClose}>✕</button>
                        </div>
                    </div>

                    {/* Title — editable (#108) */}
                    <div className="kb-detail-title-row">
                        {editingTitle ? (
                            <input
                                ref={titleInputRef}
                                className="kb-detail-title-input"
                                value={titleValue}
                                onChange={e => setTitleValue(e.target.value)}
                                onBlur={handleTitleSave}
                                onKeyDown={handleTitleKeyDown}
                            />
                        ) : (
                            <h2
                                className="kb-detail-title kb-detail-title--editable"
                                onClick={handleTitleEdit}
                                title="Click to edit title"
                            >{liveIssue.title}</h2>
                        )}
                    </div>

                    <div className="kb-detail-body">
                        {jsonMode ? (
                            /* JSON Editor (#111) */
                            <div className="kb-json-editor">
                                <textarea
                                    className="kb-json-textarea"
                                    value={jsonValue}
                                    onChange={e => { setJsonValue(e.target.value); setJsonError(null) }}
                                    spellCheck={false}
                                />
                                {jsonError && (
                                    <div className="kb-json-error">⚠ {jsonError}</div>
                                )}
                                <div className="kb-json-actions">
                                    <button className="kb-json-save" onClick={handleJsonSave}>Save JSON</button>
                                    <button className="kb-json-cancel" onClick={() => setJsonMode(false)}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            /* Main content with collapsible sections (#102) */
                            <div className="kb-detail-main">
                                {/* Workspaces — top, always open */}
                                <CollapsibleSection title="Workspaces" icon="🔀" defaultOpen={true}>
                                    <WorkspacePanel
                                        issue={liveIssue}
                                        activeWorkspace={activeWorkspace}
                                        onSelectWorkspace={handleWorkspaceExpand}
                                    />
                                </CollapsibleSection>

                                {/* Details (status, priority, labels, dates, artifacts) */}
                                <CollapsibleSection title="Details" icon="⚙️" defaultOpen={false}>
                                    <IssueSidebar
                                        issue={liveIssue}
                                        columns={columns}
                                        labels={boardLabels}
                                        onStatusChange={handleStatusChange}
                                        onUpdateIssue={(updates) => actions.updateIssue(issue.id, updates)}
                                    />
                                </CollapsibleSection>

                                {/* Markdown body */}
                                <CollapsibleSection title="Description" icon="📝" defaultOpen={false}>
                                    <IssueBody
                                        description={liveIssue.description}
                                        issueId={issue.id}
                                        onSave={(desc) => actions.updateIssue(issue.id, { description: desc })}
                                    />
                                </CollapsibleSection>

                                {/* Contextual Information */}
                                {contextEntries.length > 0 && (
                                    <CollapsibleSection title="Context" icon="📋" defaultOpen={false}>
                                        <div className="kb-context-grid">
                                            {contextEntries.map(([key, value]) => (
                                                <div key={key} className="kb-context-item">
                                                    <span className="kb-context-key">{key}</span>
                                                    <span className="kb-context-value">
                                                        {isUrl(value) ? (
                                                            <a href={value} target="_blank" rel="noopener noreferrer" className="kb-context-link">
                                                                {value}
                                                            </a>
                                                        ) : value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleSection>
                                )}

                                <CollapsibleSection title="Artifacts" icon="🗂️" defaultOpen={false}>
                                    <ArtifactList
                                        artifacts={liveIssue.artifacts}
                                        onUpdate={(artifacts) => actions.updateIssue(issue.id, { artifacts })}
                                    />
                                </CollapsibleSection>

                                <CollapsibleSection title="Relationships" icon="🔗" defaultOpen={false}>
                                    <RelationshipList
                                        relationships={liveIssue.relationships}
                                        allIssues={state.issues}
                                        issueId={issue.id}
                                        onUpdate={(relationships) => actions.updateIssue(issue.id, { relationships })}
                                    />
                                </CollapsibleSection>

                                {/* Discussion — bottom */}
                                <CollapsibleSection title="Discussion" icon="💬" defaultOpen={false}>
                                    <IssueChat
                                        chatMessages={liveIssue.chatMessages}
                                        onSend={handleSendChat}
                                    />
                                </CollapsibleSection>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}

function isUrl(str) {
    if (typeof str !== 'string') return false
    return /^https?:\/\//.test(str)
}
