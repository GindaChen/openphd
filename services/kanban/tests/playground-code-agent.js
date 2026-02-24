#!/usr/bin/env node
// ── Playground: Code Agent with ReAct Loop ──
// Uses library coding tools (readFile, writeFile, bash, listFiles)
// and the code-agent prompt from prompts/code-agent.md.
//
// Usage: ANTHROPIC_API_KEY=<key> node services/kanban/tests/playground-code-agent.js

import { Agent } from '@mariozechner/pi-agent-core'
import { getModel, streamSimple, getEnvApiKey } from '@mariozechner/pi-ai'
import { createCodingTools } from '../lib/tools/index.js'
import { loadPrompt } from '../lib/agent-engine.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

// ── Create a temp workspace ──
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'code-agent-'))
console.log(`📂 Workspace: ${workspace}`)

// ── Use library tools — no more hardcoding ──
const tools = createCodingTools({ workspaceDir: workspace })

// ── Main ──

async function main() {
    console.log('🧪 Playground: Code Agent with ReAct Loop')
    console.log('━'.repeat(50))

    const agent = new Agent({
        streamFn: streamSimple,
        getApiKey: (provider) => getEnvApiKey(provider),
    })

    agent.setModel(getModel('anthropic', 'claude-sonnet-4-6'))
    agent.setSystemPrompt(loadPrompt('code-agent'))
    agent.setTools(tools)

    let turnCount = 0
    agent.subscribe(event => {
        switch (event.type) {
            case 'agent_start':
                console.log('\n🟢 Agent started')
                break
            case 'turn_start':
                turnCount++
                console.log(`\n── Turn ${turnCount} ──`)
                break
            case 'tool_execution_start':
                console.log(`   🔧 ${event.toolName}(${JSON.stringify(event.args).slice(0, 120)})`)
                break
            case 'tool_execution_end': {
                const text = event.result?.content?.[0]?.text || ''
                const preview = text.split('\n').slice(0, 3).join('\n')
                console.log(`   ✅ → ${preview.slice(0, 150)}${text.length > 150 ? '...' : ''}`)
                break
            }
            case 'message_end':
                if (event.message.role === 'assistant') {
                    const content = event.message.content
                        ?.filter(c => c.type === 'text')
                        ?.map(c => c.text)
                        ?.join('') || ''
                    if (content) console.log(`\n💬 ${content.slice(0, 300)}${content.length > 300 ? '...' : ''}`)
                }
                break
            case 'agent_end':
                console.log(`\n🔴 Agent finished (${turnCount} turns)`)
                break
        }
    })

    const task = process.argv[2] || 'Create a Node.js script that generates the first 20 Fibonacci numbers, writes them to fib.txt, then reads the file back and prints the sum. Test it works.'
    console.log(`\n👤 Task: ${task}`)

    await agent.prompt(task)

    console.log('\n' + '━'.repeat(50))
    console.log(`📂 Workspace contents:`)
    try { console.log(execSync('find . -type f', { cwd: workspace, encoding: 'utf-8' }) || '(empty)') } catch { }
    console.log(`🗑️  Cleanup: rm -rf ${workspace}`)
    console.log('✨ Done!')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
