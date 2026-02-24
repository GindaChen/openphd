import { useState } from 'react'
import { getLabelColor, COLUMNS } from '../../store/kanbanData'
import { PRIORITIES, PRIORITY_STYLES, getPriorityStyle } from '../../utils/priorities'

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


export default function IssueSidebar({ issue, columns, labels, onStatusChange, onUpdateIssue, compact }) {
    const boardLabels = labels || {}
    const cols = columns || COLUMNS
    const [addingLabel, setAddingLabel] = useState(false)
    const [newLabel, setNewLabel] = useState('')
    const [editingDate, setEditingDate] = useState(null) // 'created' | 'updated' | null

    const handlePriorityChange = async (e) => {
        if (onUpdateIssue) {
            await onUpdateIssue({ priority: e.target.value })
        }
    }

    const handleRemoveLabel = async (label) => {
        if (onUpdateIssue) {
            await onUpdateIssue({ labels: issue.labels.filter(l => l !== label) })
        }
    }

    const handleAddLabel = async () => {
        const trimmed = newLabel.trim().toLowerCase()
        if (trimmed && !issue.labels.includes(trimmed)) {
            if (onUpdateIssue) {
                await onUpdateIssue({ labels: [...issue.labels, trimmed] })
            }
        }
        setNewLabel('')
        setAddingLabel(false)
    }

    const handleDateChange = async (field, value) => {
        if (onUpdateIssue && value) {
            await onUpdateIssue({ [field]: new Date(value).toISOString() })
        }
        setEditingDate(null)
    }

    // Compact mode: inline badges in header row (#100)
    if (compact) {
        const ps = PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES.none
        return (
            <div className="kb-sidebar-compact">
                <select
                    className="kb-sidebar-select-compact"
                    value={issue.status}
                    onChange={e => onStatusChange(e.target.value)}
                >
                    {cols.map(col => (
                        <option key={col.id} value={col.id}>{col.emoji} {col.label}</option>
                    ))}
                </select>
                <span className="kb-priority-badge" style={{ color: ps.color }}>
                    <span className="kb-priority-icon">{ps.icon}</span>
                    {ps.label}
                </span>
            </div>
        )
    }

    // Full mode: detailed sidebar
    const ps = PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES.none

    return (
        <div className="kb-detail-sidebar-full">
            {/* Status */}
            <div className="kb-sidebar-row">
                <span className="kb-sidebar-label">Status</span>
                <select
                    className="kb-sidebar-select"
                    value={issue.status}
                    onChange={e => onStatusChange(e.target.value)}
                >
                    {cols.map(col => (
                        <option key={col.id} value={col.id}>{col.emoji} {col.label}</option>
                    ))}
                </select>
            </div>

            {/* Priority — editable dropdown (#108, #103) */}
            <div className="kb-sidebar-row">
                <span className="kb-sidebar-label">Priority</span>
                <select
                    className="kb-sidebar-select kb-priority-select"
                    value={issue.priority}
                    onChange={handlePriorityChange}
                    style={{ color: ps.color }}
                >
                    {PRIORITIES.map(p => (
                        <option key={p} value={p}>{PRIORITY_STYLES[p].icon} {PRIORITY_STYLES[p].label}</option>
                    ))}
                </select>
            </div>

            {/* Labels — with add/remove (#108) */}
            <div className="kb-sidebar-row">
                <span className="kb-sidebar-label">Labels</span>
                <div className="kb-sidebar-labels">
                    {issue.labels.map(label => {
                        const colors = getLabelColor(label, boardLabels)
                        return (
                            <span key={label} className="kb-label kb-label--removable" style={{ background: colors.bg, color: colors.text }}>
                                {label}
                                <button className="kb-label-remove" onClick={() => handleRemoveLabel(label)}>×</button>
                            </span>
                        )
                    })}
                    {addingLabel ? (
                        <input
                            className="kb-label-input"
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            onBlur={handleAddLabel}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddLabel(); if (e.key === 'Escape') setAddingLabel(false) }}
                            placeholder="label name"
                            autoFocus
                        />
                    ) : (
                        <button className="kb-label-add" onClick={() => setAddingLabel(true)}>+ Add</button>
                    )}
                </div>
            </div>

            {/* Dates + Artifacts — compact row */}
            <div className="kb-sidebar-meta-row" style={{
                display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px',
                paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.08)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="kb-sidebar-label" style={{ minWidth: 'auto', margin: 0 }}>Created</span>
                    {editingDate === 'created' ? (
                        <input
                            type="date"
                            className="kb-sidebar-date-input"
                            defaultValue={issue.createdAt?.split('T')[0]}
                            onBlur={e => handleDateChange('createdAt', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleDateChange('createdAt', e.target.value); if (e.key === 'Escape') setEditingDate(null) }}
                            autoFocus
                        />
                    ) : (
                        <span className="kb-sidebar-value kb-sidebar-value--editable" onClick={() => setEditingDate('created')} style={{ fontSize: '12px' }}>
                            {formatDate(issue.createdAt)}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="kb-sidebar-label" style={{ minWidth: 'auto', margin: 0 }}>Updated</span>
                    {editingDate === 'updated' ? (
                        <input
                            type="date"
                            className="kb-sidebar-date-input"
                            defaultValue={issue.updatedAt?.split('T')[0]}
                            onBlur={e => handleDateChange('updatedAt', e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleDateChange('updatedAt', e.target.value); if (e.key === 'Escape') setEditingDate(null) }}
                            autoFocus
                        />
                    ) : (
                        <span className="kb-sidebar-value kb-sidebar-value--editable" onClick={() => setEditingDate('updated')} style={{ fontSize: '12px' }}>
                            {formatDate(issue.updatedAt)}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="kb-sidebar-label" style={{ minWidth: 'auto', margin: 0 }}>Artifacts</span>
                    <span className="kb-sidebar-value" style={{ fontSize: '12px' }}>{issue.artifacts?.length || 0}</span>
                </div>
            </div>
        </div>
    )
}
