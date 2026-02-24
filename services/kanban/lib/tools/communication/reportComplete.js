// ── Tool: reportComplete ──
// Worker marks its task as complete and signals the master.

import { Type } from '@sinclair/typebox'
import { writeOutbox, updateStatus } from '../../agent-mailbox.js'

export default function createReportComplete(ctx) {
    const { agentId, mailboxBase } = ctx

    return {
        name: 'reportComplete',
        description: 'Report that your task is complete. Include a summary of what you accomplished. This will signal the master and end your session.',
        label: 'Report Complete',
        parameters: Type.Object({
            summary: Type.String({ description: 'Summary of what was accomplished' }),
            success: Type.Optional(Type.Boolean({
                description: 'Whether the task was successful (default: true)',
                default: true,
            })),
        }),
        execute: async (toolCallId, params) => {
            const success = params.success !== false

            writeOutbox(agentId, `[COMPLETE] ${params.summary}`, mailboxBase)
            updateStatus(agentId, {
                status: success ? 'complete' : 'error',
                result: params.summary,
                exitCode: success ? 0 : 1,
            }, mailboxBase)

            return {
                content: [{ type: 'text', text: `Task ${success ? 'completed' : 'failed'}: ${params.summary}` }],
                details: { success, summary: params.summary },
            }
        },
    }
}
