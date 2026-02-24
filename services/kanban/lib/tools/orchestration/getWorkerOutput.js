// ── Tool: getWorkerOutput ──
// Reads messages a worker has sent to the master (from worker's outbox).

import fs from 'fs'
import path from 'path'
import { Type } from '@sinclair/typebox'

export default function createGetWorkerOutput(ctx) {
    const { mailboxBase } = ctx

    return {
        name: 'getWorkerOutput',
        description: 'Read messages and results from a specific worker agent. Returns the worker\'s outbox messages.',
        label: 'Get Worker Output',
        parameters: Type.Object({
            agentId: Type.String({ description: 'The worker agent ID to read output from' }),
            limit: Type.Optional(Type.Number({ description: 'Max messages to return (default: 20)' })),
        }),
        execute: async (toolCallId, params) => {
            const limit = params.limit || 20
            const outboxPath = path.join(mailboxBase, params.agentId, 'outbox.jsonl')

            try {
                const content = fs.readFileSync(outboxPath, 'utf-8').trim()
                if (!content) {
                    return {
                        content: [{ type: 'text', text: `Worker ${params.agentId} has no output yet.` }],
                        details: { messages: [] },
                    }
                }

                const messages = content.split('\n')
                    .map(line => { try { return JSON.parse(line) } catch { return null } })
                    .filter(Boolean)
                    .slice(-limit)

                const summary = messages.map((m, i) => {
                    const body = typeof m.content === 'string' ? m.content
                        : typeof m.content === 'object' ? JSON.stringify(m.content)
                            : String(m.content || '')
                    return `[${i + 1}] ${m.from || 'unknown'}: ${body.slice(0, 200)}`
                }).join('\n')

                return {
                    content: [{ type: 'text', text: summary || 'No messages.' }],
                    details: { messages, count: messages.length },
                }
            } catch (e) {
                if (e.code === 'ENOENT') {
                    return {
                        content: [{ type: 'text', text: `Worker ${params.agentId} not found or has no output.` }],
                        details: { messages: [] },
                    }
                }
                return {
                    content: [{ type: 'text', text: `Error reading output: ${e.message}` }],
                    details: { error: e.message },
                }
            }
        },
    }
}
