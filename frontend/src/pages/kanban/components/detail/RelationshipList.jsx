import { useState } from 'react'

const RELATIONSHIP_TYPES = [
    { id: 'blocks', label: '⛔ Blocks', inverse: 'blocked-by' },
    { id: 'blocked-by', label: '🚧 Blocked by', inverse: 'blocks' },
    { id: 'relates-to', label: '🔗 Related to', inverse: 'relates-to' },
    { id: 'duplicates', label: '🔄 Duplicates', inverse: 'duplicates' },
]

function getTypeLabel(type) {
    return RELATIONSHIP_TYPES.find(t => t.id === type)?.label || `🔗 ${type}`
}

export default function RelationshipList({ relationships, allIssues, issueId, onUpdate }) {
    const [adding, setAdding] = useState(false)
    const [form, setForm] = useState({ type: 'relates-to', targetId: '' })
    const [searchQuery, setSearchQuery] = useState('')

    const items = relationships || []

    // Filter issues for the picker (exclude self)
    const filteredIssues = allIssues.filter(i =>
        i.id !== issueId &&
        !items.some(r => r.targetId === i.id) &&
        (searchQuery === '' || i.title.toLowerCase().includes(searchQuery.toLowerCase()) || String(i.id).includes(searchQuery))
    )

    const handleAdd = () => {
        const tid = parseInt(form.targetId)
        if (!tid || !allIssues.find(i => i.id === tid)) return
        const newRel = {
            type: form.type,
            targetId: tid,
            createdAt: new Date().toISOString(),
        }
        onUpdate?.([...items, newRel])
        setForm({ type: 'relates-to', targetId: '' })
        setSearchQuery('')
        setAdding(false)
    }

    const handleDelete = (idx) => {
        onUpdate?.(items.filter((_, i) => i !== idx))
    }

    const handleTypeChange = (idx, newType) => {
        onUpdate?.(items.map((r, i) => i === idx ? { ...r, type: newType } : r))
    }

    return (
        <div className="kb-relationships-list">
            {items.length === 0 && !adding && (
                <div className="kb-relationships-empty">No relationships</div>
            )}
            {items.map((rel, idx) => {
                const target = allIssues.find(i => i.id === rel.targetId)
                if (!target) return null
                return (
                    <div key={idx} className="kb-relationship-row">
                        <select
                            className="kb-relationship-type-select"
                            value={rel.type}
                            onChange={e => handleTypeChange(idx, e.target.value)}
                        >
                            {RELATIONSHIP_TYPES.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                        <div className="kb-relationship-target">
                            <span className="kb-relationship-id">#{target.id}</span>
                            <span className="kb-relationship-title">{target.title}</span>
                        </div>
                        <button
                            className="kb-artifact-action-btn kb-artifact-action-btn--delete"
                            onClick={() => handleDelete(idx)}
                            title="Remove relationship"
                        >✕</button>
                    </div>
                )
            })}

            {adding ? (
                <div className="kb-relationship-form">
                    <select
                        className="kb-relationship-type-select"
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value })}
                    >
                        {RELATIONSHIP_TYPES.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                    </select>
                    <div className="kb-relationship-picker">
                        <input
                            className="kb-relationship-search"
                            placeholder="Search issues by # or title..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value)
                                // Auto-select if exact #N match
                                const match = e.target.value.match(/^#?(\d+)$/)
                                if (match) setForm({ ...form, targetId: match[1] })
                            }}
                            autoFocus
                        />
                        {searchQuery && filteredIssues.length > 0 && (
                            <div className="kb-relationship-dropdown">
                                {filteredIssues.slice(0, 8).map(issue => (
                                    <div
                                        key={issue.id}
                                        className="kb-relationship-option"
                                        onClick={() => {
                                            setForm({ ...form, targetId: String(issue.id) })
                                            setSearchQuery(`#${issue.id} ${issue.title}`)
                                        }}
                                    >
                                        <span className="kb-relationship-option-id">#{issue.id}</span>
                                        <span className="kb-relationship-option-title">{issue.title}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="kb-artifact-form-actions">
                        <button className="kb-artifact-form-btn kb-artifact-form-btn--save" onClick={handleAdd} disabled={!form.targetId}>Add</button>
                        <button className="kb-artifact-form-btn" onClick={() => { setAdding(false); setSearchQuery('') }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="kb-artifact-add-btn" onClick={() => setAdding(true)}>
                    + Add relationship
                </button>
            )}
        </div>
    )
}
