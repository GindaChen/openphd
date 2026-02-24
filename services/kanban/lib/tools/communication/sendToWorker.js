// ── Tool: sendToWorker ──
// Sends a message to a worker agent's inbox.

import { Type } from '@sinclair/typebox'
import { sendMessage } from '../../agent-mailbox.js'

export default function createSendToWorker(ctx) {
    const { mailboxBase } = ctx

    return {
        name: 'sendToWorker',
        description: 'Send a message to a worker agent.',
        label: 'Send to Worker',
        parameters: Type.Object({
            agentId: Type.String({ description: 'The worker agent ID' }),
            message: Type.String({ description: 'Message content to send' }),
        }),
        execute: async (toolCallId, params) => {
            const msg = sendMessage(params.agentId, params.message, mailboxBase)
            return {
                content: [{ type: 'text', text: `Sent message to ${params.agentId}: "${params.message}"` }],
                details: { sent: msg },
            }
        },
    }
}
