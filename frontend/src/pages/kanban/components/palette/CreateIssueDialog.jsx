import { useState, useEffect, useRef } from 'react'
import { useKanban, COLUMNS } from '../../store/kanbanData'

/**
 * CreateIssueDialog — modal dialog for creating a new issue.
 * Triggered from the Command Palette "Create Issue" action.
 *
 * Fields: title, status (column), body/description, labels.
 */
export default function CreateIssueDialog({ isOpen, onClose, onCreated }) {
    const [title, setTitle] = useState('')
    const [status, setStatus] = useState('backlog')
    const [body, setBody] = useState('')
    const [labels, setLabels] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState(null)
    const titleRef = useRef(null)
    const { actions } = useKanban()

    useEffect(() => {
        if (isOpen) {
            setTitle('')
            setStatus('backlog')
            setBody('')
            setLabels('')
            setError(null)
            setCreating(false)
            setTimeout(() => titleRef.current?.focus(), 80)
        }
    }, [isOpen])

    // Global Escape to close
    useEffect(() => {
        if (!isOpen) return
        const handler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isOpen, onClose])

    const handleSubmit = async (e) => {
        e?.preventDefault()
        const trimmed = title.trim()
        if (!trimmed) return

        setCreating(true)
        setError(null)
        try {
            const labelList = labels
                .split(',')
                .map(l => l.trim())
                .filter(Boolean)

            const issue = await actions.createIssue(trimmed, {
                status,
                body: body.trim() || undefined,
                labels: labelList.length > 0 ? labelList : undefined,
            })
            onClose()
            onCreated?.(issue)
        } catch (err) {
            setError(err.message || 'Failed to create issue')
        } finally {
            setCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="kb-create-dialog-overlay" onClick={onClose}>
            <div className="kb-create-dialog" onClick={e => e.stopPropagation()}>
                <div className="kb-create-dialog-header">
                    <h2 className="kb-create-dialog-title">
                        <span className="kb-create-dialog-icon">✨</span>
                        Create Issue
                    </h2>
                    <button className="kb-create-dialog-close" onClick={onClose}>✕</button>
                </div>

                <form className="kb-create-dialog-body" onSubmit={handleSubmit}>
                    {/* Title */}
                    <div className="kb-create-dialog-field">
                        <label className="kb-create-dialog-label">Title</label>
                        <input
                            ref={titleRef}
                            className="kb-create-dialog-input"
                            placeholder="Issue title..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Status */}
                    <div className="kb-create-dialog-field">
                        <label className="kb-create-dialog-label">Status</label>
                        <div className="kb-create-dialog-status-row">
                            {COLUMNS.map(col => (
                                <button
                                    key={col.id}
                                    type="button"
                                    className={`kb-create-dialog-status-btn ${status === col.id ? 'kb-create-dialog-status-btn--active' : ''}`}
                                    onClick={() => setStatus(col.id)}
                                    title={col.description}
                                >
                                    <span>{col.emoji}</span>
                                    <span>{col.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="kb-create-dialog-field">
                        <label className="kb-create-dialog-label">Description <span className="kb-create-dialog-optional">(optional)</span></label>
                        <textarea
                            className="kb-create-dialog-textarea"
                            placeholder="Describe the issue... (Markdown supported)"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={4}
                        />
                    </div>

                    {/* Labels */}
                    <div className="kb-create-dialog-field">
                        <label className="kb-create-dialog-label">Labels <span className="kb-create-dialog-optional">(optional, comma-separated)</span></label>
                        <input
                            className="kb-create-dialog-input"
                            placeholder="bug, enhancement, priority:high"
                            value={labels}
                            onChange={e => setLabels(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="kb-create-dialog-error">❌ {error}</div>
                    )}
                </form>

                <div className="kb-create-dialog-footer">
                    <button
                        className="kb-create-dialog-cancel"
                        onClick={onClose}
                        disabled={creating}
                    >Cancel</button>
                    <button
                        className="kb-create-dialog-submit"
                        onClick={handleSubmit}
                        disabled={!title.trim() || creating}
                    >
                        {creating ? '⏳ Creating...' : '✨ Create Issue'}
                    </button>
                </div>
            </div>
        </div>
    )
}
