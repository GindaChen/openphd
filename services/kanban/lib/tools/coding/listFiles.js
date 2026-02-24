// ── Tool: listFiles ──
import { execSync } from 'child_process'
import { Type } from '@sinclair/typebox'

export default function createListFiles(ctx = {}) {
    const { workspaceDir } = ctx
    return {
        name: 'listFiles',
        description: 'List files in the workspace. Shows up to 50 files.',
        label: 'List Files',
        parameters: Type.Object({
            path: Type.Optional(Type.String({ description: 'Subdirectory to list (default: root)' })),
        }),
        execute: async (toolCallId, params) => {
            const dir = params.path || '.'
            try {
                const output = execSync(`find ${dir} -type f | head -50`, {
                    cwd: workspaceDir || process.cwd(),
                    encoding: 'utf-8',
                    timeout: 5000,
                })
                return { content: [{ type: 'text', text: output || '(empty)' }], details: {} }
            } catch (e) {
                return { content: [{ type: 'text', text: `Error: ${e.message}` }], details: { error: e.message } }
            }
        },
    }
}
