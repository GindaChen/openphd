// ── Tool: spawnWorker ──
// Spawns a worker agent as a child process.

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { Type } from '@sinclair/typebox'
import {
    createMailbox, registerAgent, updateStatus, getStatus,
} from '../../agent-mailbox.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function createSpawnWorker(ctx) {
    const { mailboxBase, workerScript } = ctx
    const defaultWorkerScript = workerScript || path.join(__dirname, '..', '..', 'worker-entry.js')

    return {
        name: 'spawnWorker',
        description: 'Spawn a worker agent to perform a task. Returns the agent ID.',
        label: 'Spawn Worker',
        parameters: Type.Object({
            task: Type.String({ description: 'Task description for the worker' }),
            type: Type.Optional(Type.String({
                description: 'Worker type: "general" or "code"',
                default: 'general',
            })),
        }),
        execute: async (toolCallId, params) => {
            const agentId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            const type = params.type || 'general'

            createMailbox(agentId, mailboxBase)
            updateStatus(agentId, {
                status: 'running', task: params.task, type,
            }, mailboxBase)
            registerAgent(agentId, {
                task: params.task, type, status: 'running',
            }, mailboxBase)

            // Initialize cursor via context callback
            ctx.onWorkerSpawned?.(agentId)

            const child = spawn('node', [
                defaultWorkerScript,
                '--id', agentId,
                '--mailbox', mailboxBase,
                '--task', params.task,
                '--type', type,
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false,
                env: { ...process.env },
            })

            updateStatus(agentId, { pid: child.pid }, mailboxBase)

            child.on('exit', (code) => {
                const status = getStatus(agentId, mailboxBase)
                if (status && status.status === 'running') {
                    updateStatus(agentId, {
                        status: code === 0 ? 'complete' : 'error',
                        exitCode: code,
                    }, mailboxBase)
                }
            })

            child.stdout.on('data', (data) => {
                process.stderr.write(`[${agentId}] ${data}`)
            })
            child.stderr.on('data', (data) => {
                process.stderr.write(`[${agentId} ERR] ${data}`)
            })

            return {
                content: [{ type: 'text', text: `Spawned worker ${agentId} (pid=${child.pid}) for task: "${params.task}"` }],
                details: { agentId, pid: child.pid, task: params.task, type },
            }
        },
    }
}
