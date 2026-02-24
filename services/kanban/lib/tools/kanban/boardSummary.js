// ── Tool: boardSummary ──
// Returns a summary of the kanban board with issue counts per column.

import { Type } from '@sinclair/typebox'
import fs from 'fs'
import path from 'path'
import { readJSON } from '../../helpers.js'
import { ensureBootstrapped } from '../../project.js'

export default function createBoardSummary(ctx) {
    const { dataDir } = ctx

    return {
        name: 'boardSummary',
        description: 'Get a summary of the kanban board with issue counts per column.',
        label: 'Board Summary',
        parameters: Type.Object({}),
        execute: async (toolCallId, params) => {
            ensureBootstrapped(dataDir)
            const issuesDir = path.join(dataDir, 'issues')
            const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.json'))
            const issues = files.map(f => readJSON(path.join(issuesDir, f))).filter(Boolean)

            const board = readJSON(path.join(dataDir, 'board.json'))
            const columns = (board.columns || []).map(c => ({
                column: c.label,
                emoji: c.emoji,
                id: c.id,
                count: issues.filter(i => i.status === c.id).length,
            }))

            const lines = columns.map(c => `${c.emoji} ${c.column}: ${c.count}`)
            const summary = `Board: ${issues.length} total issues\n${lines.join('\n')}`

            return {
                content: [{ type: 'text', text: summary }],
                details: { total: issues.length, columns },
            }
        },
    }
}
