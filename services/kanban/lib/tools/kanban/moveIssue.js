// ── Tool: moveIssue ──
// Moves a kanban issue to a different column/status.

import { Type } from '@sinclair/typebox'
import fs from 'fs'
import path from 'path'
import { readJSON, writeJSON } from '../../helpers.js'

export default function createMoveIssue(ctx) {
    const { dataDir } = ctx

    return {
        name: 'moveIssue',
        description: 'Move a kanban issue to a different column/status.',
        label: 'Move Issue',
        parameters: Type.Object({
            id: Type.Number({ description: 'Issue ID' }),
            status: Type.String({
                description: 'Target status column',
                enum: ['backlog', 'ideation', 'in-progress', 'blocked', 'review', 'done'],
            }),
        }),
        execute: async (toolCallId, params) => {
            const issuesDir = path.join(dataDir, 'issues')
            const jsonPath = path.join(issuesDir, `${params.id}.json`)
            if (!fs.existsSync(jsonPath)) {
                return {
                    content: [{ type: 'text', text: `Issue #${params.id} not found.` }],
                    isError: true,
                }
            }
            const issue = readJSON(jsonPath)
            const oldStatus = issue.status
            issue.status = params.status
            issue.updatedAt = new Date().toISOString()
            writeJSON(jsonPath, issue)

            return {
                content: [{ type: 'text', text: `Moved issue #${params.id} from "${oldStatus}" to "${params.status}".` }],
                details: { id: params.id, oldStatus, newStatus: params.status },
            }
        },
    }
}
