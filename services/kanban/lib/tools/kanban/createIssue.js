// ── Tool: createIssue ──
// Creates a new kanban issue in the project.

import { Type } from '@sinclair/typebox'
import fs from 'fs'
import path from 'path'
import { readJSON, writeJSON, writeMD } from '../../helpers.js'
import { ensureBootstrapped, getNextId } from '../../project.js'

export default function createCreateIssue(ctx) {
    const { dataDir } = ctx

    return {
        name: 'createIssue',
        description: 'Create a new kanban issue on the board.',
        label: 'Create Issue',
        parameters: Type.Object({
            title: Type.String({ description: 'Issue title' }),
            status: Type.Optional(Type.String({
                description: 'Initial status column',
                enum: ['backlog', 'ideation', 'in-progress', 'blocked', 'review', 'done'],
            })),
            priority: Type.Optional(Type.String({
                description: 'Issue priority',
                enum: ['none', 'low', 'medium', 'high', 'critical'],
            })),
            labels: Type.Optional(Type.Array(Type.String(), { description: 'Issue labels' })),
            description: Type.Optional(Type.String({ description: 'Issue description (markdown)' })),
        }),
        execute: async (toolCallId, params) => {
            ensureBootstrapped(dataDir)
            const issuesDir = path.join(dataDir, 'issues')
            const fakeReq = { headers: {} }
            // We need to use the direct dataDir approach
            const metaPath = path.join(dataDir, '.meta.json')
            const meta = readJSON(metaPath)
            const id = meta.nextId
            meta.nextId = id + 1
            writeJSON(metaPath, meta)

            const now = new Date().toISOString()
            const issue = {
                id,
                title: params.title || 'Untitled',
                status: params.status || 'backlog',
                priority: params.priority || 'none',
                labels: params.labels || [],
                contextualInfo: {},
                artifacts: [],
                relationships: [],
                chatMessages: [],
                createdAt: now,
                updatedAt: now,
            }
            writeJSON(path.join(issuesDir, `${id}.json`), issue)
            writeMD(path.join(issuesDir, `${id}.md`),
                params.description || `# ${issue.title}\n\n(No description yet)\n`)

            return {
                content: [{ type: 'text', text: `Created issue #${id}: "${issue.title}" in ${issue.status}.` }],
                details: { id, title: issue.title, status: issue.status },
            }
        },
    }
}
