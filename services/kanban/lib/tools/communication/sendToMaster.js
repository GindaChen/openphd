// ── Tool: sendToMaster ──
// Worker writes a message to its outbox (master reads this).

import { Type } from '@sinclair/typebox'
import { writeOutbox } from '../../agent-mailbox.js'

export default function createSendToMaster(ctx) {
    const { agentId, mailboxBase } = ctx

    return {
        name: 'sendToMaster',
        description: 'Send a message to the master agent. Use this to report progress, ask questions, or request input.',
        label: 'Send to Master',
        parameters: Type.Object({
            message: Type.String({ description: 'Message to send to the master agent' }),
        }),
        execute: async (toolCallId, params) => {
            const msg = writeOutbox(agentId, params.message, mailboxBase)
            return {
                content: [{ type: 'text', text: `Message sent to master: "${params.message}"` }],
                details: { sent: msg },
            }
        },
    }
}
