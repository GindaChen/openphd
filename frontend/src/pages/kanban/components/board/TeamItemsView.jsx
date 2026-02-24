import { useState, useMemo } from 'react'
import { useKanban, COLUMNS, getLabelColor } from '../../store/kanbanData'
import { PRIORITY_ORDER, PRIORITY_STYLES, getPriorityStyle } from '../../utils/priorities'

const GROUP_BY_OPTIONS = [
    { id: 'status', label: 'Status' },
    { id: 'priority', label: 'Priority' },
    { id: 'label', label: 'Label' },
    { id: 'none', label: 'None' },
]

const SORT_OPTIONS = [
    { id: 'id-asc', label: '# ↑', field: 'id', dir: 1 },
    { id: 'id-desc', label: '# ↓', field: 'id', dir: -1 },
    { id: 'title-asc', label: 'Title A-Z', field: 'title', dir: 1 },
    { id: 'priority-asc', label: 'Priority ↑', field: 'priority', dir: 1 },
    { id: 'created-desc', label: 'Newest', field: 'createdAt', dir: -1 },
    { id: 'updated-desc', label: 'Recently updated', field: 'updatedAt', dir: -1 },
]

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sortIssues(issues, sortOption) {
    const { field, dir } = sortOption
    return [...issues].sort((a, b) => {
        let va = a[field], vb = b[field]
        if (field === 'priority') { va = PRIORITY_ORDER[va] ?? 99; vb = PRIORITY_ORDER[vb] ?? 99 }
        if (typeof va === 'string') return dir * va.localeCompare(vb)
        return dir * ((va > vb ? 1 : va < vb ? -1 : 0))
    })
}

export default function TeamItemsView({ onSelectIssue }) {
    const { state } = useKanban()
    const columns = state.board?.columns || COLUMNS
    const boardLabels = state.board?.labels || {}
    const [groupBy, setGroupBy] = useState('status')
    const [sortId, setSortId] = useState('id-asc')
    const sortOption = SORT_OPTIONS.find(s => s.id === sortId) || SORT_OPTIONS[0]

    const grouped = useMemo(() => {
        const issues = sortIssues(state.issues, sortOption)
        if (groupBy === 'none') return [{ key: 'all', label: `All Items (${issues.length})`, emoji: '', issues }]
        if (groupBy === 'status') return columns.map(col => ({ key: col.id, label: col.label, emoji: col.emoji, issues: issues.filter(i => i.status === col.id) })).filter(g => g.issues.length > 0)
        if (groupBy === 'priority') return Object.keys(PRIORITY_ORDER).map(p => ({ key: p, label: PRIORITY_STYLES[p].label, emoji: PRIORITY_STYLES[p].icon, issues: issues.filter(i => i.priority === p) })).filter(g => g.issues.length > 0)
        if (groupBy === 'label') {
            const labelSet = new Set(); issues.forEach(i => (i.labels || []).forEach(l => labelSet.add(l)))
            const groups = [...labelSet].map(label => ({ key: label, label, emoji: '', issues: issues.filter(i => (i.labels || []).includes(label)) }))
            const unlabeled = issues.filter(i => !i.labels?.length)
            if (unlabeled.length) groups.push({ key: '__none', label: 'Unlabeled', emoji: '', issues: unlabeled })
            return groups.filter(g => g.issues.length > 0)
        }
        return [{ key: 'all', label: 'All', emoji: '', issues }]
    }, [state.issues, groupBy, sortOption, columns])

    if (state.loading) return <div className="kb-team-loading"><div className="spinner" /><span>Loading items...</span></div>

    return (
        <div className="kb-team">
            <div className="kb-team-controls">
                <div className="kb-team-control">
                    <label className="kb-team-control-label">Group by</label>
                    <select className="kb-team-select" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                        {GROUP_BY_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                </div>
                <div className="kb-team-control">
                    <label className="kb-team-control-label">Sort</label>
                    <select className="kb-team-select" value={sortId} onChange={e => setSortId(e.target.value)}>
                        {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                </div>
                <div className="kb-team-stat">{state.issues.length} items</div>
            </div>
            <div className="kb-team-table-wrapper">
                <table className="kb-team-table">
                    <thead><tr className="kb-team-thead-row">
                        <th className="kb-team-th kb-team-th--id">#</th>
                        <th className="kb-team-th kb-team-th--title">Title</th>
                        <th className="kb-team-th kb-team-th--status">Status</th>
                        <th className="kb-team-th kb-team-th--priority">Priority</th>
                        <th className="kb-team-th kb-team-th--labels">Labels</th>
                        <th className="kb-team-th kb-team-th--date">Created</th>
                        <th className="kb-team-th kb-team-th--date">Updated</th>
                    </tr></thead>
                    <tbody>
                        {grouped.map(group => <GroupRows key={group.key} group={group} labels={boardLabels} columns={columns} onSelectIssue={onSelectIssue} />)}
                    </tbody>
                </table>
            </div>
            {state.issues.length === 0 && <div className="kb-team-empty">No items to display.</div>}
        </div>
    )
}

function GroupRows({ group, labels, columns, onSelectIssue }) {
    const [collapsed, setCollapsed] = useState(false)
    return (
        <>
            <tr className="kb-team-group-row" onClick={() => setCollapsed(!collapsed)}>
                <td colSpan={7} className="kb-team-group-cell">
                    <span className="kb-team-group-chevron">{collapsed ? '▸' : '▾'}</span>
                    {group.emoji && <span className="kb-team-group-emoji">{group.emoji}</span>}
                    <span className="kb-team-group-label">{group.label}</span>
                    <span className="kb-team-group-count">{group.issues.length}</span>
                </td>
            </tr>
            {!collapsed && group.issues.map(issue => {
                const col = columns.find(c => c.id === issue.status)
                const ps = PRIORITY_STYLES[issue.priority] || PRIORITY_STYLES.none
                return (
                    <tr key={issue.id} className="kb-team-row" onClick={() => onSelectIssue?.(issue)}>
                        <td className="kb-team-td kb-team-td--id">#{issue.ghId || issue.id}</td>
                        <td className="kb-team-td kb-team-td--title">{issue.title}</td>
                        <td className="kb-team-td kb-team-td--status"><span className="kb-team-status-badge">{col?.emoji} {col?.label || issue.status}</span></td>
                        <td className="kb-team-td kb-team-td--priority"><span style={{ color: ps.color, fontWeight: 600 }}>{ps.icon} {ps.label}</span></td>
                        <td className="kb-team-td kb-team-td--labels"><div className="kb-team-labels">
                            {(issue.labels || []).map(label => { const colors = getLabelColor(label, labels); return <span key={label} className="kb-label" style={{ background: colors.bg, color: colors.text }}>{label}</span> })}
                        </div></td>
                        <td className="kb-team-td kb-team-td--date">{formatDate(issue.createdAt)}</td>
                        <td className="kb-team-td kb-team-td--date">{formatDate(issue.updatedAt)}</td>
                    </tr>
                )
            })}
        </>
    )
}
