// ── Tool: listWorkers ──
// Lists all registered worker agents with rich status info.

import { Type } from '@sinclair/typebox'
import { loadRegistry, getStatus } from '../../agent-mailbox.js'

function formatAge(ms) {
    if (ms < 1000) return `${ms}ms`
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m${s % 60}s`
}

export default function createListWorkers(ctx) {
    const { mailboxBase } = ctx

    return {
        name: 'listWorkers',
        description: 'List all registered worker agents with their status, uptime, and activity.',
        label: 'List Workers',
        parameters: Type.Object({
            status: Type.Optional(Type.String({
                description: 'Filter by status: "running", "complete", or "error"',
            })),
        }),
        execute: async (toolCallId, params) => {
            const registry = loadRegistry(mailboxBase)
            const now = Date.now()
            let workers = Object.entries(registry.agents).map(([id, info]) => {
                const status = getStatus(id, mailboxBase) || {}
                const uptime = status.startedAt ? formatAge(now - status.startedAt) : '?'
                const lastActive = status.lastActivity ? formatAge(now - status.lastActivity) + ' ago' : 'never'
                return {
                    agentId: id,
                    task: info.task,
                    type: info.type || 'general',
                    status: status.status || 'unknown',
                    pid: status.pid,
                    uptime,
                    lastActive,
                    toolCalls: status.toolCalls || 0,
                    turns: status.turns || 0,
                    lastToolName: status.lastToolName || null,
                    result: status.result || null,
                }
            })

            // Filter by status if requested
            if (params.status) {
                workers = workers.filter(w => w.status === params.status)
            }

            if (workers.length === 0) {
                const msg = params.status
                    ? `No workers with status "${params.status}".`
                    : 'No workers registered.'
                return { content: [{ type: 'text', text: msg }], details: { workers: [] } }
            }

            const lines = workers.map(w => {
                const emoji = w.status === 'complete' ? '✅' : w.status === 'error' ? '❌' : w.status === 'running' ? '🔄' : '❓'
                const toolInfo = w.toolCalls > 0 ? ` | ${w.toolCalls} tools (last: ${w.lastToolName})` : ''
                return `${emoji} ${w.agentId} [${w.status}] (${w.type}) — uptime: ${w.uptime}, active: ${w.lastActive}${toolInfo}\n   Task: ${w.task}`
            })

            const summary = `${workers.length} worker(s):\n${lines.join('\n')}`

            return {
                content: [{ type: 'text', text: summary }],
                details: { workers },
            }
        },
    }
}
