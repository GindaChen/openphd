// ── Tool: listIssues ──
// Lists all kanban issues, optionally filtered by status.

import { Type } from '@sinclair/typebox'
import fs from 'fs'
import path from 'path'
import { readJSON, readMD } from '../../helpers.js'
import { ensureBootstrapped } from '../../project.js'

export default function createListIssues(ctx) {
    const { dataDir } = ctx

    return {
        name: 'listIssues',
        description: 'List all kanban issues, optionally filtered by status.',
        label: 'List Issues',
        parameters: Type.Object({
            status: Type.Optional(Type.String({
                description: 'Filter by status (optional)',
                enum: ['backlog', 'ideation', 'in-progress', 'blocked', 'review', 'done'],
            })),
        }),
        execute: async (toolCallId, params) => {
            ensureBootstrapped(dataDir)
            const issuesDir = path.join(dataDir, 'issues')
            const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.json'))
            let issues = files.map(f => readJSON(path.join(issuesDir, f))).filter(Boolean)

            if (params.status) {
                issues = issues.filter(i => i.status === params.status)
            }

            issues.sort((a, b) => a.id - b.id)

            if (issues.length === 0) {
                const msg = params.status
                    ? `No issues with status "${params.status}".`
                    : 'No issues on the board.'
                return { content: [{ type: 'text', text: msg }], details: { issues: [] } }
            }

            const lines = issues.map(i => {
                const labels = i.labels?.length ? ` [${i.labels.join(', ')}]` : ''
                return `#${i.id} [${i.status}] ${i.title}${labels} (${i.priority || 'none'})`
            })

            return {
                content: [{ type: 'text', text: `${issues.length} issue(s):\n${lines.join('\n')}` }],
                details: { issues: issues.map(i => ({ id: i.id, title: i.title, status: i.status, priority: i.priority })) },
            }
        },
    }
}
