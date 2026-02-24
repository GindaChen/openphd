// ── Tool: waitForSignals ──
// Blocks until a signal arrives from any worker (message, exit, or timeout).

import { Type } from '@sinclair/typebox'
import { waitForSignals as waitForSignalsFn, saveCursors } from '../../agent-mailbox.js'

export default function createWaitForSignals(ctx) {
    const { mailboxBase, cursors } = ctx

    return {
        name: 'waitForSignals',
        description: 'Block and wait for signals from worker agents. Returns when: a worker sends a message, a worker exits, or timeout (60s). Use this when you have nothing to do and are waiting for workers.',
        label: 'Wait for Signals',
        parameters: Type.Object({
            timeoutSeconds: Type.Optional(Type.Number({
                description: 'Max seconds to wait (default: 60)',
                default: 60,
            })),
        }),
        execute: async (toolCallId, params, signal) => {
            const timeoutMs = (params.timeoutSeconds || 60) * 1000
            const signals = await waitForSignalsFn(cursors, mailboxBase, {
                timeoutMs, signal, pollIntervalMs: 500,
            })

            // Update and persist cursors
            for (const sig of signals) {
                if (sig.type === 'agent_message' && sig.newCursor !== undefined) {
                    cursors[sig.agentId] = sig.newCursor
                }
            }
            saveCursors(cursors, mailboxBase)

            const summary = signals.map(sig => {
                if (sig.type === 'agent_exit') {
                    return `[EXIT] ${sig.agentId}: status=${sig.status}, exitCode=${sig.exitCode}`
                }
                if (sig.type === 'agent_message') {
                    return `[MSG] ${sig.agentId}: ${sig.messages.map(m => m.content).join('; ')}`
                }
                if (sig.type === 'timeout') {
                    return '[TIMEOUT] No signals received'
                }
                return `[UNKNOWN] ${JSON.stringify(sig)}`
            }).join('\n')

            return {
                content: [{ type: 'text', text: summary }],
                details: { signals },
            }
        },
    }
}
