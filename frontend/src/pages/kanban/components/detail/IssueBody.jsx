import { useState, useRef, useEffect } from 'react'

// Simple markdown renderer — handles bold, italic, code, links, headers, lists, linebreaks
function renderMarkdown(text) {
    if (!text) return ''
    return text
        // Headers
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre class="kb-md-codeblock">$1</pre>')
        // Inline code
        .replace(/`(.+?)`/g, '<code class="kb-md-code">$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // List items
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n/g, '<br/>')
}

export default function IssueBody({ description, issueId, onSave }) {
    const [mode, setMode] = useState('preview')  // 'edit' | 'preview'
    const [value, setValue] = useState(description || '')
    const textareaRef = useRef(null)

    // Sync external description changes
    useEffect(() => {
        if (mode === 'preview') {
            setValue(description || '')
        }
    }, [description, mode])

    const handleSwitchToEdit = () => {
        setValue(description || '')
        setMode('edit')
        // Focus textarea after render
        setTimeout(() => textareaRef.current?.focus(), 50)
    }

    const handleSwitchToPreview = () => {
        // Auto-save on switching to preview if changed
        if (value !== (description || '') && onSave) {
            onSave(value)
        }
        setMode('preview')
    }

    const handleSave = () => {
        if (onSave) onSave(value)
        setMode('preview')
    }

    return (
        <div className="kb-body-wrapper">
            {/* Tab bar */}
            <div className="kb-body-tabs">
                <button
                    className={`kb-body-tab ${mode === 'edit' ? 'kb-body-tab--active' : ''}`}
                    onClick={handleSwitchToEdit}
                >
                    ✏️ Edit
                </button>
                <button
                    className={`kb-body-tab ${mode === 'preview' ? 'kb-body-tab--active' : ''}`}
                    onClick={handleSwitchToPreview}
                >
                    👁 Preview
                </button>
            </div>

            {mode === 'edit' ? (
                <div className="kb-body-editor">
                    <textarea
                        ref={textareaRef}
                        className="kb-body-textarea"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Write a description using markdown..."
                        autoFocus
                    />
                    <div className="kb-body-editor-actions">
                        <button className="kb-body-save" onClick={handleSave}>Save</button>
                        <button className="kb-body-cancel" onClick={() => { setValue(description || ''); setMode('preview') }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <div
                    className="kb-body kb-body--editable"
                    onClick={handleSwitchToEdit}
                    title="Click to edit description"
                >
                    {description ? (
                        <div
                            className="kb-body-content kb-body-rendered"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
                        />
                    ) : (
                        <div className="kb-body-placeholder">Click to add a description...</div>
                    )}
                </div>
            )}
        </div>
    )
}
