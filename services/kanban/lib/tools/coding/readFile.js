// ── Tool: readFile ──
import fs from 'fs'
import path from 'path'
import { Type } from '@sinclair/typebox'

export default function createReadFile(ctx = {}) {
    const { workspaceDir } = ctx
    return {
        name: 'readFile',
        description: 'Read the contents of a file. Use offset/limit for large files.',
        label: 'Read File',
        parameters: Type.Object({
            path: Type.String({ description: 'File path (relative to workspace or absolute)' }),
            offset: Type.Optional(Type.Number({ description: 'Start line (1-indexed)' })),
            limit: Type.Optional(Type.Number({ description: 'Max lines (default: 2000)' })),
        }),
        execute: async (toolCallId, params) => {
            const fullPath = workspaceDir ? path.resolve(workspaceDir, params.path) : path.resolve(params.path)
            try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                const lines = content.split('\n')
                const offset = (params.offset || 1) - 1
                const limit = params.limit || 2000
                const sliced = lines.slice(offset, offset + limit).join('\n')
                return {
                    content: [{ type: 'text', text: sliced }],
                    details: { path: params.path, totalLines: lines.length },
                }
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], details: { error: e.message } }
            }
        },
    }
}
