import { useState } from 'react'

export default function PromptDebug({ debug }) {
    const [expanded, setExpanded] = useState(false)
    if (!debug) return null
    return (
        <div className="kb-ask-prompt-debug">
            <div className="kb-ask-prompt-debug-toggle" onClick={() => setExpanded(e => !e)}>
                <span>{expanded ? '▾' : '▸'}</span>
                <span className="kb-ask-prompt-debug-label">Prompt Context</span>
                <span className="kb-ask-prompt-debug-meta">
                    {debug.messages?.length || 0} msgs · {debug.toolCount || 0} tools
                </span>
            </div>
            {expanded && (
                <div className="kb-ask-prompt-debug-body">
                    <div className="kb-ask-prompt-debug-section">
                        <strong>System Prompt</strong>
                        <pre>{debug.systemPrompt}</pre>
                    </div>
                    {debug.messages?.length > 0 && (
                        <div className="kb-ask-prompt-debug-section">
                            <strong>Message History ({debug.messages.length})</strong>
                            {debug.messages.map((m, i) => (
                                <div key={i} className={`kb-ask-prompt-debug-msg kb-ask-prompt-debug-msg--${m.role}`}>
                                    <span className="kb-ask-prompt-debug-role">{m.role}</span>
                                    <span>{(m.content || '').slice(0, 300)}{m.content?.length > 300 ? '…' : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="kb-ask-prompt-debug-section">
                        <strong>User Message</strong>
                        <pre>{debug.userMessage}</pre>
                    </div>
                    {debug.model && (
                        <div className="kb-ask-prompt-debug-section">
                            <strong>Model</strong>: {typeof debug.model === 'string' ? debug.model : JSON.stringify(debug.model)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
