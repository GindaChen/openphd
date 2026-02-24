import { useState, useCallback } from 'react'
import { useKanban, COLUMNS } from '../../store/kanbanData'
import { getSetting } from '../../store/settings'
import IssueCard from './IssueCard'

export default function KanbanBoard({ onSelectIssue }) {
    const { state, actions } = useKanban()
    const columns = state.board?.columns || COLUMNS
    const [dragOverCol, setDragOverCol] = useState(null)
    const [draggedIssueId, setDraggedIssueId] = useState(null)
    const [creatingInCol, setCreatingInCol] = useState(null) // which column is creating
    const [newTitle, setNewTitle] = useState('')

    const handleDragStart = useCallback((e, issue) => {
        setDraggedIssueId(issue.id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(issue.id))
        if (e.target) {
            requestAnimationFrame(() => {
                e.target.style.opacity = '0.4'
            })
        }
    }, [])

    const handleDragEnd = useCallback((e) => {
        setDraggedIssueId(null)
        setDragOverCol(null)
        if (e.target) e.target.style.opacity = '1'
    }, [])

    const handleDragOver = useCallback((e, colId) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverCol(colId)
    }, [])

    const handleDragLeave = useCallback((e) => {
        if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
            setDragOverCol(null)
        }
    }, [])

    const handleDrop = useCallback(async (e, colId) => {
        e.preventDefault()
        setDragOverCol(null)
        const issueId = parseInt(e.dataTransfer.getData('text/plain'))
        if (!issueId) return

        const issue = state.issues.find(i => i.id === issueId)
        if (!issue || issue.status === colId) return

        try {
            await actions.moveIssue(issueId, colId)
        } catch (err) {
            console.error('Failed to move issue:', err)
        }
    }, [state.issues, actions])

    const handleCreateIssue = async (colId) => {
        const title = newTitle.trim()
        if (!title) return
        try {
            const issue = await actions.createIssue(title, { status: colId })
            setCreatingInCol(null)
            setNewTitle('')
            onSelectIssue?.(issue)
        } catch (err) {
            console.error('Failed to create issue:', err)
        }
    }

    const handleAddClick = (colId) => {
        if (creatingInCol === colId) {
            setCreatingInCol(null)
            setNewTitle('')
        } else {
            setCreatingInCol(colId)
            setNewTitle('')
            // Focus the input after render
            setTimeout(() => {
                const input = document.querySelector(`.kb-create-input[data-col="${colId}"]`)
                input?.focus()
            }, 50)
        }
    }

    if (state.loading) {
        return (
            <div className="kb-board" style={{ padding: '40px', justifyContent: 'center' }}>
                <div className="loading"><div className="spinner" /><span>Loading board...</span></div>
            </div>
        )
    }

    const colWidth = getSetting('kanbanColumnWidth') || 280

    return (
        <div className="kb-board" tabIndex={0}>
            {columns.map(col => {
                const issues = state.issues.filter(i => i.status === col.id)
                const isOver = dragOverCol === col.id
                const isCreating = creatingInCol === col.id
                return (
                    <div
                        key={col.id}
                        className={`kb-column ${isOver ? 'kb-column--drag-over' : ''}`}
                        data-column-id={col.id}
                        style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }}
                        onDragOver={(e) => handleDragOver(e, col.id)}
                        onDragLeave={(e) => handleDragLeave(e, col.id)}
                        onDrop={(e) => handleDrop(e, col.id)}
                    >
                        <div className="kb-column-header">
                            <div className="kb-column-title">
                                <span className="kb-column-emoji">{col.emoji}</span>
                                <span className="kb-column-name">{col.label}</span>
                                <span className="kb-column-count">{issues.length}</span>
                            </div>
                            <button
                                className={`kb-column-add ${isCreating ? 'kb-column-add--active' : ''}`}
                                title="Add issue"
                                onClick={() => handleAddClick(col.id)}
                            >{isCreating ? '✕' : '+'}</button>
                        </div>
                        <div className="kb-column-desc">{col.description}</div>

                        {/* Inline create form */}
                        {isCreating && (
                            <div className="kb-create-form">
                                <input
                                    className="kb-create-input"
                                    data-col={col.id}
                                    placeholder="Issue title..."
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateIssue(col.id)
                                        if (e.key === 'Escape') { setCreatingInCol(null); setNewTitle('') }
                                    }}
                                />
                                <button
                                    className="kb-create-submit"
                                    onClick={() => handleCreateIssue(col.id)}
                                    disabled={!newTitle.trim()}
                                >Create</button>
                            </div>
                        )}

                        <div className="kb-column-cards">
                            {issues.map(issue => (
                                <IssueCard
                                    key={issue.id}
                                    issue={issue}
                                    onClick={onSelectIssue}
                                    isDragging={draggedIssueId === issue.id}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                />
                            ))}
                            {issues.length === 0 && !isCreating && (
                                <div className={`kb-column-empty ${isOver ? 'kb-column-empty--active' : ''}`}>
                                    {isOver ? 'Drop here' : 'No items'}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
