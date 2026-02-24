import { useState } from 'react'

// ── Tool call display helpers ──
const TOOL_ICONS = {
    createIssue: '📝', moveIssue: '🔀', listIssues: '📋', boardSummary: '📊',
    saveMemory: '💾', searchMemory: '🔍',
    createGithubIssue: '🐙', commentOnIssue: '💬',
    spawnWorker: '🚀', listWorkers: '👥', getWorkerOutput: '📤',
    sendToWorker: '📨', waitForSignals: '📡',
}
const TOOL_LABELS = {
    createIssue: 'Created issue', moveIssue: 'Moved issue', listIssues: 'Listed issues',
    boardSummary: 'Board summary', saveMemory: 'Saved to memory', searchMemory: 'Searched memory',
    createGithubIssue: 'Created GitHub issue', commentOnIssue: 'Commented on issue',
    spawnWorker: 'Spawned worker', listWorkers: 'Listed workers', getWorkerOutput: 'Worker output',
    sendToWorker: 'Sent to worker', waitForSignals: 'Waiting for signals',
}

export default function ToolChip({ tool, args, result }) {
    const [expanded, setExpanded] = useState(false)
    const icon = TOOL_ICONS[tool] || '🔧'
    const label = TOOL_LABELS[tool] || tool

    // Build a short summary from args
    let summary = ''
    if (args?.title) summary = `"${args.title}"`
    else if (args?.id) summary = `#${args.id}`
    else if (args?.key) summary = args.key
    else if (args?.query) summary = `"${args.query}"`
    else if (args?.issue_number) summary = `#${args.issue_number}`

    const hasError = result?.error

    return (
        <div className={`kb-ask-tool-chip ${hasError ? 'kb-ask-tool-chip--error' : ''}`}>
            <div className="kb-ask-tool-chip-header" onClick={() => setExpanded(e => !e)}>
                <span className="kb-ask-tool-chip-icon">{icon}</span>
                <span className="kb-ask-tool-chip-label">{label}</span>
                {summary && <span className="kb-ask-tool-chip-summary">{summary}</span>}
                {hasError && <span className="kb-ask-tool-chip-error">failed</span>}
                <span className="kb-ask-tool-chip-chevron">{expanded ? '▾' : '▸'}</span>
            </div>
            {expanded && (
                <pre className="kb-ask-tool-chip-detail">
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    )
}
