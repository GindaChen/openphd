// ── Tool: writeFile ──
import fs from 'fs'
import path from 'path'
import { Type } from '@sinclair/typebox'

export default function createWriteFile(ctx = {}) {
    const { workspaceDir } = ctx
    return {
        name: 'writeFile',
        description: 'Write content to a file. Creates parent directories as needed.',
        label: 'Write File',
        parameters: Type.Object({
            path: Type.String({ description: 'File path (relative to workspace or absolute)' }),
            content: Type.String({ description: 'File content to write' }),
        }),
        execute: async (toolCallId, params) => {
            const fullPath = workspaceDir ? path.resolve(workspaceDir, params.path) : path.resolve(params.path)
            try {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true })
                fs.writeFileSync(fullPath, params.content)
                return {
                    content: [{ type: 'text', text: `Wrote ${params.content.length} bytes to ${params.path}` }],
                    details: { path: params.path, size: params.content.length },
                }
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], details: { error: e.message } }
            }
        },
    }
}
