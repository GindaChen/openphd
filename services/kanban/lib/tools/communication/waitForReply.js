// ── Tool: waitForReply ──
// Worker polls its inbox for a reply from the master.

import { Type } from '@sinclair/typebox'
import { readInbox } from '../../agent-mailbox.js'

export default function createWaitForReply(ctx) {
    const { agentId, mailboxBase } = ctx
    let inboxCursor = 0

    return {
        name: 'waitForReply',
        description: 'Wait for a reply from the master agent. Blocks until a new message arrives in your inbox. Use this after sending a message that requires a response.',
        label: 'Wait for Reply',
        parameters: Type.Object({
            timeoutSeconds: Type.Optional(Type.Number({
                description: 'Max seconds to wait (default: 120)',
                default: 120,
            })),
        }),
        execute: async (toolCallId, params, signal) => {
            const timeoutMs = (params.timeoutSeconds || 120) * 1000
            const start = Date.now()

            return new Promise((resolve, reject) => {
                const check = () => {
                    if (signal?.aborted) {
                        reject(new Error('Aborted'))
                        return
                    }

                    const { messages, totalLines } = readInbox(agentId, inboxCursor, mailboxBase)
                    if (messages.length > 0) {
                        inboxCursor = totalLines
                        const reply = messages[messages.length - 1]
                        resolve({
                            content: [{ type: 'text', text: `Reply from master: "${reply.content}"` }],
                            details: { messages, reply },
                        })
                        return
                    }

                    if (Date.now() - start > timeoutMs) {
                        resolve({
                            content: [{ type: 'text', text: 'Timeout: no reply received from master.' }],
                            details: { timeout: true },
                        })
                        return
                    }

                    setTimeout(check, 500)
                }
                check()
            })
        },
    }
}
