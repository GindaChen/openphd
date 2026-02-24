// ── Tool: bash ──
import { execSync } from 'child_process'
import { Type } from '@sinclair/typebox'

export default function createBash(ctx = {}) {
    const { workspaceDir } = ctx
    return {
        name: 'bash',
        description: 'Execute a bash command. Returns stdout and stderr.',
        label: 'Bash',
        parameters: Type.Object({
            command: Type.String({ description: 'Bash command to execute' }),
            timeout: Type.Optional(Type.Number({ description: 'Timeout in seconds (default: 30)' })),
        }),
        execute: async (toolCallId, params) => {
            const timeoutMs = (params.timeout || 30) * 1000
            try {
                const output = execSync(params.command, {
                    cwd: workspaceDir || process.cwd(),
                    timeout: timeoutMs,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                })
                return {
                    content: [{ type: 'text', text: output || '(no output)' }],
                    details: { exitCode: 0 },
                }
            } catch (e) {
                const output = (e.stdout || '') + (e.stderr || '')
                return {
                    content: [{ type: 'text', text: `Exit code ${e.status}: ${output || e.message}` }],
                    details: { exitCode: e.status, error: e.message },
                }
            }
        },
    }
}
