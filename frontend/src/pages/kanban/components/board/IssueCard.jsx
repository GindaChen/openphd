import { useKanban, getLabelColor } from '../../store/kanbanData'
import { getPriorityStyle } from '../../utils/priorities'

export default function IssueCard({ issue, onClick, isDragging, onDragStart, onDragEnd }) {
    const { state } = useKanban()
    const boardLabels = state.board?.labels || {}

    const totalArtifacts = issue.artifacts?.length || 0
    const hasRelations = issue.relationships?.length > 0
    const commentCount = issue.chatMessages?.length || 0
    const wsCount = issue.workspaces?.length || 0
    const ps = getPriorityStyle(issue.priority)

    return (
        <div
            className={`kb-card ${isDragging ? 'kb-card--dragging' : ''}`}
            data-issue-id={issue.id}
            onClick={() => onClick(issue)}
            draggable
            onDragStart={(e) => onDragStart(e, issue)}
            onDragEnd={onDragEnd}
        >
            <div className="kb-card-repo">
                {issue.ghUrl ? (
                    <a href={issue.ghUrl} target="_blank" rel="noopener noreferrer"
                        className="kb-card-number kb-card-gh-link"
                        onClick={e => e.stopPropagation()}
                        title={`View #${issue.ghId} on GitHub`}>
                        #{issue.ghId}
                    </a>
                ) : (
                    <span className="kb-card-number">#{issue.id}</span>
                )}
                <span className="kb-card-priority-badge" style={{ color: ps.color }}>
                    {ps.icon}
                </span>
            </div>
            <div className="kb-card-title">{issue.title}</div>
            {issue.labels?.length > 0 && (
                <div className="kb-card-labels">
                    {issue.labels.map(label => {
                        const colors = getLabelColor(label, boardLabels)
                        return (
                            <span key={label} className="kb-label" style={{ background: colors.bg, color: colors.text }}>
                                {label}
                            </span>
                        )
                    })}
                </div>
            )}

        </div>
    )
}
