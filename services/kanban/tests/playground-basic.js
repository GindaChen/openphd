#!/usr/bin/env node
// ── Playground: Basic Agent Conversation ──
// Demonstrates a simple agent with kanban-like tools responding to a prompt.
//
// Usage: ANTHROPIC_API_KEY=<key> node services/kanban/tests/playground-basic.js

import { Agent } from '@mariozechner/pi-agent-core'
import { getModel, streamSimple, getEnvApiKey } from '@mariozechner/pi-ai'
import { Type } from '@sinclair/typebox'

// ── Simple in-memory kanban tools (no filesystem needed) ──

const issues = [
    { id: 1, title: 'Set up CI pipeline', status: 'done', priority: 'high' },
    { id: 2, title: 'Implement auth system', status: 'in-progress', priority: 'high' },
    { id: 3, title: 'Design landing page', status: 'backlog', priority: 'medium' },
    { id: 4, title: 'Write API documentation', status: 'backlog', priority: 'low' },
    { id: 5, title: 'Fix login redirect bug', status: 'blocked', priority: 'critical' },
]

const tools = [
    {
        name: 'listIssues',
        description: 'List all issues on the kanban board, optionally filtered by status',
        label: 'List Issues',
        parameters: Type.Object({
            status: Type.Optional(Type.String({ description: 'Filter by status' })),
        }),
        execute: async (toolCallId, params) => {
            let filtered = issues
            if (params.status) filtered = issues.filter(i => i.status === params.status)
            const text = filtered.map(i => `#${i.id} [${i.status}] (${i.priority}) ${i.title}`).join('\n')
            return {
                content: [{ type: 'text', text: text || 'No issues found.' }],
                details: { issues: filtered },
            }
        },
    },
    {
        name: 'boardSummary',
        description: 'Get a count of issues by status',
        label: 'Board Summary',
        parameters: Type.Object({}),
        execute: async () => {
            const counts = {}
            for (const i of issues) counts[i.status] = (counts[i.status] || 0) + 1
            const text = Object.entries(counts).map(([s, c]) => `${s}: ${c}`).join(', ')
            return {
                content: [{ type: 'text', text: `Board: ${issues.length} issues — ${text}` }],
                details: { counts },
            }
        },
    },
    {
        name: 'moveIssue',
        description: 'Move an issue to a different status',
        label: 'Move Issue',
        parameters: Type.Object({
            id: Type.Number({ description: 'Issue ID' }),
            status: Type.String({ description: 'New status' }),
        }),
        execute: async (toolCallId, params) => {
            const issue = issues.find(i => i.id === params.id)
            if (!issue) return { content: [{ type: 'text', text: `Issue #${params.id} not found` }], details: {} }
            const old = issue.status
            issue.status = params.status
            return {
                content: [{ type: 'text', text: `Moved #${params.id} from ${old} → ${params.status}` }],
                details: { id: params.id, old, new: params.status },
            }
        },
    },
]

// ── Main ──

async function main() {
    console.log('🧪 Playground: Basic Agent Conversation')
    console.log('━'.repeat(50))

    const agent = new Agent({
        streamFn: streamSimple,
        getApiKey: (provider) => getEnvApiKey(provider),
    })

    agent.setModel(getModel('anthropic', 'claude-sonnet-4-6'))
    agent.setSystemPrompt(`You are a helpful project assistant managing a kanban board.
Use your tools to answer questions about the board. Be concise.`)
    agent.setTools(tools)

    // Subscribe to events
    agent.subscribe(event => {
        switch (event.type) {
            case 'agent_start':
                console.log('\n🟢 Agent started')
                break
            case 'tool_execution_start':
                console.log(`   🔧 ${event.toolName}(${JSON.stringify(event.args)})`)
                break
            case 'tool_execution_end':
                const text = event.result?.content?.[0]?.text || ''
                console.log(`   ✅ → ${text.slice(0, 100)}`)
                break
            case 'message_end':
                if (event.message.role === 'assistant') {
                    const content = event.message.content
                        ?.filter(c => c.type === 'text')
                        ?.map(c => c.text)
                        ?.join('') || ''
                    if (content) console.log(`\n💬 Assistant:\n${content}`)
                }
                break
            case 'agent_end':
                console.log('\n🔴 Agent finished')
                break
        }
    })

    // Send a prompt
    const prompt = process.argv[2] || 'Give me a summary of the board and move the blocked issue to in-progress.'
    console.log(`\n👤 User: ${prompt}`)

    await agent.prompt(prompt)

    console.log('\n' + '━'.repeat(50))
    console.log('✨ Done!')
}

main().catch(err => {
    console.error('Fatal error:', err.message)
    process.exit(1)
})
