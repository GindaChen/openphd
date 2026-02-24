#!/usr/bin/env node
// ── Worker Entry Point ──
// Standalone script spawned by the master agent.
// Usage: node worker-entry.js --id <agent-id> --mailbox <path> --task <task> --type <general|code>

import { createWorkerAgent } from './agent-engine.js'
import { updateStatus } from './agent-mailbox.js'

// ── Parse CLI args ──
function parseArgs() {
    const args = process.argv.slice(2)
    const parsed = {}
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--id') parsed.id = args[++i]
        else if (args[i] === '--mailbox') parsed.mailbox = args[++i]
        else if (args[i] === '--task') parsed.task = args[++i]
        else if (args[i] === '--type') parsed.type = args[++i]
    }
    return parsed
}

async function main() {
    const { id, mailbox, task, type = 'general' } = parseArgs()

    if (!id || !mailbox || !task) {
        console.error('Usage: node worker-entry.js --id <id> --mailbox <path> --task <task> [--type <type>]')
        process.exit(1)
    }

    console.log(`[Worker ${id}] Starting (type=${type})`)
    console.log(`[Worker ${id}] Task: ${task}`)

    // Update status to running
    const startedAt = Date.now()
    updateStatus(id, { status: 'running', pid: process.pid, startedAt, toolCalls: 0, turns: 0 }, mailbox)

    // Create worker agent
    const agent = createWorkerAgent({
        agentId: id,
        mailboxBase: mailbox,
        type,
        task,
        apiKey: process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY,
        provider: process.env.LLM_PROVIDER || 'anthropic',
        modelId: process.env.LLM_MODEL || 'claude-sonnet-4-6',
    })

    // Progress tracking
    let toolCalls = 0
    let turns = 0

    // Subscribe to events for logging + status updates
    agent.subscribe(event => {
        switch (event.type) {
            case 'agent_start':
                console.log(`[Worker ${id}] Agent started`)
                break
            case 'turn_start':
                turns++
                updateStatus(id, { turns, lastActivity: Date.now() }, mailbox)
                break
            case 'message_end':
                if (event.message.role === 'assistant') {
                    const text = event.message.content
                        ?.filter(c => c.type === 'text')
                        ?.map(c => c.text)
                        ?.join('') || ''
                    if (text) console.log(`[Worker ${id}] Response: ${text.slice(0, 200)}`)
                }
                break
            case 'tool_execution_start':
                toolCalls++
                updateStatus(id, {
                    toolCalls,
                    lastToolName: event.toolName,
                    lastActivity: Date.now(),
                }, mailbox)
                console.log(`[Worker ${id}] Tool: ${event.toolName}(${JSON.stringify(event.args).slice(0, 100)})`)
                break
            case 'tool_execution_end':
                if (event.isError) {
                    console.error(`[Worker ${id}] Tool error: ${event.toolName}`)
                }
                break
            case 'agent_end':
                console.log(`[Worker ${id}] Agent finished`)
                break
        }
    })

    try {
        // Run the agent with the task
        await agent.prompt(task)

        // Check if agent reported complete (via reportComplete tool)
        // If not, mark as complete anyway
        const { getStatus } = await import('./agent-mailbox.js')
        const status = getStatus(id, mailbox)
        if (status?.status === 'running') {
            updateStatus(id, {
                status: 'complete',
                result: 'Worker finished without explicit reportComplete',
                exitCode: 0,
            }, mailbox)
        }

        console.log(`[Worker ${id}] Done`)
        process.exit(0)
    } catch (err) {
        console.error(`[Worker ${id}] Error: ${err.message}`)
        updateStatus(id, {
            status: 'error',
            result: err.message,
            exitCode: 1,
        }, mailbox)
        process.exit(1)
    }
}

main()
