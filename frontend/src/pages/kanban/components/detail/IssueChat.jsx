import { useState, useRef, useEffect } from 'react'

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso) {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * IssueChat — Human-to-human discussion panel (like GitHub issue comments).
 * AI interactions are kept separate in the Master Chat panel.
 * Only shows messages with role === 'user' (human comments).
 */
export default function IssueChat({ chatMessages, onSend }) {
    const [input, setInput] = useState('')
    const chatEndRef = useRef(null)

    // Filter to only human discussion messages (not AI)
    const humanMessages = (chatMessages || []).filter(msg => msg.role === 'user' || msg.role === 'comment')

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [humanMessages.length])

    const handleSend = () => {
        if (!input.trim()) return
        onSend(input.trim())
        setInput('')
    }

    return (
        <div className="kb-issue-chat-wrapper">
            <div className="kb-issue-chat-hint">
                💡 Discussion is for human notes and comments.
                <span className="kb-issue-chat-hint-sub">Use the project chat panel (⌘J) for AI assistance.</span>
            </div>
            <div className="kb-issue-chat">
                {humanMessages.length === 0 && (
                    <div className="kb-chat-empty">No comments yet — add a note to this issue</div>
                )}
                {humanMessages.map((msg, idx) => (
                    <div key={idx} className="kb-chat-msg kb-chat-msg--user kb-chat-msg--comment">
                        <div className="kb-chat-avatar">👤</div>
                        <div className="kb-chat-bubble">
                            <div className="kb-chat-meta">
                                <span className="kb-chat-role">
                                    {msg.author || 'You'}
                                </span>
                                <span className="kb-chat-time">
                                    {msg.timestamp ? `${formatDate(msg.timestamp)} ${formatTime(msg.timestamp)}` : ''}
                                </span>
                            </div>
                            <div className="kb-chat-text">{msg.content}</div>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <div className="kb-chat-input-row">
                <input
                    className="kb-chat-input"
                    placeholder="Add a comment..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button className="kb-chat-send" onClick={handleSend} disabled={!input.trim()}>Comment</button>
            </div>
        </div>
    )
}
