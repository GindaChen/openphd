import { useMemo, useState, useRef, useCallback } from 'react'
import { useKanban, COLUMNS, getLabelColor } from '../../store/kanbanData'

const STATUS_COLORS = {
    'backlog': '#6B7280',
    'ideation': '#8B5CF6',
    'in-progress': '#3B82F6',
    'blocked': '#EF4444',
    'review': '#F59E0B',
    'done': '#10B981',
}

const ONE_DAY = 86400000

export default function TimelineView({ onSelectIssue }) {
    const { state, actions } = useKanban()
    const columns = state.board?.columns || COLUMNS
    const barAreaRef = useRef(null)
    const [dragState, setDragState] = useState(null)

    const timeline = useMemo(() => {
        if (!state.issues.length) return { weeks: [], issues: [], totalDays: 0, startDate: new Date() }
        const issues = [...state.issues].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        const earliest = new Date(issues[0].createdAt)
        const latest = new Date()
        const startDate = new Date(earliest)
        startDate.setDate(startDate.getDate() - startDate.getDay() + 1)
        startDate.setHours(0, 0, 0, 0)
        const endDate = new Date(latest)
        endDate.setDate(endDate.getDate() + (7 - endDate.getDay()) + 14)

        const weeks = []
        let d = new Date(startDate)
        while (d < endDate) {
            weeks.push({
                start: new Date(d),
                label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                isCurrentWeek: d <= latest && new Date(d.getTime() + 7 * ONE_DAY) > latest,
            })
            d = new Date(d.getTime() + 7 * ONE_DAY)
        }

        const totalDays = (endDate - startDate) / ONE_DAY
        const mappedIssues = issues.map(issue => {
            const created = new Date(issue.createdAt)
            const updated = new Date(issue.updatedAt || issue.createdAt)
            const isDone = issue.status === 'done'
            const barStart = (created - startDate) / ONE_DAY
            const barEnd = isDone ? (updated - startDate) / ONE_DAY : (latest - startDate) / ONE_DAY
            const barWidth = Math.max(barEnd - barStart, 1)
            return {
                ...issue,
                barLeftPercent: (barStart / totalDays) * 100,
                barWidthPercent: (barWidth / totalDays) * 100,
                color: STATUS_COLORS[issue.status] || '#6B7280',
            }
        })
        return { weeks, issues: mappedIssues, totalDays, startDate }
    }, [state.issues])

    const handleBarMouseDown = useCallback((e, issue, mode) => {
        e.stopPropagation(); e.preventDefault()
        const rect = barAreaRef.current.getBoundingClientRect()
        setDragState({ issueId: issue.id, mode, startX: e.clientX, areaWidth: rect.width, origLeftPct: issue.barLeftPercent, origWidthPct: issue.barWidthPercent })
    }, [])

    const handleMouseMove = useCallback((e) => {
        if (!dragState || !barAreaRef.current) return
        setDragState(prev => ({ ...prev, deltaPct: ((e.clientX - prev.startX) / prev.areaWidth) * 100 }))
    }, [dragState])

    const handleMouseUp = useCallback(async () => {
        if (!dragState || dragState.deltaPct === undefined) { setDragState(null); return }
        const { mode, origLeftPct, origWidthPct, deltaPct, issueId } = dragState
        let newLeftPct = origLeftPct, newWidthPct = origWidthPct
        if (mode === 'move') newLeftPct += deltaPct
        else if (mode === 'left') { newLeftPct += deltaPct; newWidthPct -= deltaPct }
        else if (mode === 'right') newWidthPct += deltaPct
        newLeftPct = Math.max(0, newLeftPct); newWidthPct = Math.max(0.5, newWidthPct)
        const newCreatedDays = (newLeftPct / 100) * timeline.totalDays
        const newEndDays = ((newLeftPct + newWidthPct) / 100) * timeline.totalDays
        const newCreatedAt = new Date(timeline.startDate.getTime() + newCreatedDays * ONE_DAY)
        const newUpdatedAt = new Date(timeline.startDate.getTime() + newEndDays * ONE_DAY)
        try {
            const updates = {}
            if (mode === 'move' || mode === 'left') updates.createdAt = newCreatedAt.toISOString()
            if (mode === 'move' || mode === 'right') updates.updatedAt = newUpdatedAt.toISOString()
            await actions.updateIssue(issueId, updates)
        } catch (err) { console.error('Failed to update dates:', err) }
        setDragState(null)
    }, [dragState, timeline, actions])

    const getBarStyle = useCallback((issue) => {
        let left = issue.barLeftPercent, width = issue.barWidthPercent
        if (dragState && dragState.issueId === issue.id && dragState.deltaPct !== undefined) {
            const delta = dragState.deltaPct
            if (dragState.mode === 'move') left += delta
            else if (dragState.mode === 'left') { left += delta; width -= delta }
            else if (dragState.mode === 'right') width += delta
        }
        return { left: `${left}%`, width: `${Math.max(width, 0.5)}%`, backgroundColor: issue.color }
    }, [dragState])

    if (state.loading) return <div className="kb-timeline-loading"><div className="spinner" /><span>Loading timeline...</span></div>

    const statusOrder = columns.map(c => c.id)
    const grouped = statusOrder.map(status => ({
        status, label: columns.find(c => c.id === status)?.label || status,
        emoji: columns.find(c => c.id === status)?.emoji || '',
        issues: timeline.issues.filter(i => i.status === status),
    })).filter(g => g.issues.length > 0)

    return (
        <div className="kb-timeline" onMouseMove={dragState ? handleMouseMove : undefined} onMouseUp={dragState ? handleMouseUp : undefined} onMouseLeave={dragState ? handleMouseUp : undefined}>
            <div className="kb-timeline-header">
                <div className="kb-timeline-label-col">Issue</div>
                <div className="kb-timeline-bar-area" ref={barAreaRef}>
                    {timeline.weeks.map((w, i) => (
                        <div key={i} className={`kb-timeline-week ${w.isCurrentWeek ? 'kb-timeline-week--current' : ''}`}
                            style={{ left: `${(i / timeline.weeks.length) * 100}%`, width: `${100 / timeline.weeks.length}%` }}>{w.label}</div>
                    ))}
                </div>
            </div>
            {grouped.map(group => (
                <div key={group.status} className="kb-timeline-group">
                    <div className="kb-timeline-group-header">
                        <span className="kb-timeline-group-emoji">{group.emoji}</span>
                        <span className="kb-timeline-group-name">{group.label}</span>
                        <span className="kb-timeline-group-count">{group.issues.length}</span>
                    </div>
                    {group.issues.map(issue => {
                        const isDragging = dragState?.issueId === issue.id
                        return (
                            <div key={issue.id} className={`kb-timeline-row ${isDragging ? 'kb-timeline-row--dragging' : ''}`}>
                                <div className="kb-timeline-label-col" onClick={() => onSelectIssue?.(issue)}>
                                    <span className="kb-timeline-issue-id">#{issue.ghId || issue.id}</span>
                                    <span className="kb-timeline-issue-title">{issue.title}</span>
                                </div>
                                <div className="kb-timeline-bar-area">
                                    {timeline.weeks.map((_, i) => <div key={i} className="kb-timeline-gridline" style={{ left: `${(i / timeline.weeks.length) * 100}%` }} />)}
                                    <div className={`kb-timeline-bar ${isDragging ? 'kb-timeline-bar--dragging' : ''}`} style={getBarStyle(issue)}
                                        title={`${issue.title}\nDrag edges to resize, drag bar to move`}>
                                        <div className="kb-timeline-handle kb-timeline-handle--left" onMouseDown={(e) => handleBarMouseDown(e, issue, 'left')} />
                                        <div className="kb-timeline-bar-body" onMouseDown={(e) => handleBarMouseDown(e, issue, 'move')}>
                                            {issue.barWidthPercent > 8 && <span className="kb-timeline-bar-label">{issue.title}</span>}
                                        </div>
                                        <div className="kb-timeline-handle kb-timeline-handle--right" onMouseDown={(e) => handleBarMouseDown(e, issue, 'right')} />
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ))}
            {timeline.issues.length === 0 && <div className="kb-timeline-empty">No issues to display on timeline.</div>}
        </div>
    )
}
