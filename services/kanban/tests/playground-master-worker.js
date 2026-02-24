#!/usr/bin/env node
// ── Playground: Master-Worker Communication ──
// Demonstrates full master-worker lifecycle with color-coded output.
//
// Usage: ANTHROPIC_API_KEY=<key> node services/kanban/tests/playground-master-worker.js

import readline from 'readline'
import { createMasterAgent } from '../lib/agent-engine.js'
import path from 'path'
import fs from 'fs'
import os from 'os'

// ── ANSI Colors ──

const COLORS = [
    '\x1b[36m',  // cyan
    '\x1b[33m',  // yellow
    '\x1b[35m',  // magenta
    '\x1b[32m',  // green
    '\x1b[34m',  // blue
    '\x1b[91m',  // bright red
    '\x1b[96m',  // bright cyan
    '\x1b[93m',  // bright yellow
]
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const MASTER_COLOR = '\x1b[97m' // bright white

const workerColorMap = new Map()
let nextColorIdx = 0

function getWorkerColor(agentId) {
    if (!workerColorMap.has(agentId)) {
        workerColorMap.set(agentId, COLORS[nextColorIdx % COLORS.length])
        nextColorIdx++
    }
    return workerColorMap.get(agentId)
}

function tag(label, color) {
    return `${BOLD}${color}[${label}]${RESET}`
}

// ── Setup ──

const mailboxBase = path.join(os.tmpdir(), `agent-mailbox-${Date.now()}`)
fs.mkdirSync(mailboxBase, { recursive: true })
console.log(`${DIM}📬 Mailbox: ${mailboxBase}${RESET}`)

// ── Create master agent ──

const master = createMasterAgent({ mailboxBase })

// ── Event logging with colors ──

master.subscribe(event => {
    const mtag = tag('master', MASTER_COLOR)

    switch (event.type) {
        case 'agent_start':
            console.log(`\n${mtag} 🟢 Processing...`)
            break
        case 'tool_execution_start': {
            const args = JSON.stringify(event.args).slice(0, 150)
            // Color the worker ID in args if present
            let display = args
            for (const [id, color] of workerColorMap) {
                display = display.replace(id, `${color}${id}${RESET}`)
            }
            console.log(`${mtag} 🔧 ${event.toolName}(${display})`)
            break
        }
        case 'tool_execution_end': {
            const text = event.result?.content?.[0]?.text || ''
            const lines = text.split('\n')
            for (const line of lines) {
                // Color worker IDs in output
                let display = line
                for (const [id, color] of workerColorMap) {
                    display = display.replaceAll(id, `${color}${id}${RESET}`)
                }
                console.log(`${mtag} ✅ ${display}`)
            }
            break
        }
        case 'message_end':
            if (event.message.role === 'assistant') {
                const content = event.message.content
                    ?.filter(c => c.type === 'text')
                    ?.map(c => c.text)
                    ?.join('') || ''
                if (content) console.log(`\n${mtag} 💬 ${content}`)
            }
            break
        case 'agent_end':
            console.log(`\n${mtag} ⏸️  Idle — waiting for input`)
            break
    }

    // Auto-color any new worker IDs from spawn results
    if (event.type === 'tool_execution_end' && event.toolName === 'spawnWorker') {
        const agentId = event.result?.details?.agentId
        if (agentId) getWorkerColor(agentId)
    }
})

// ── REPL Loop ──

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '👤 You: ',
})

rl.on('close', () => {
    console.log('\n👋 Goodbye!')
    fs.rmSync(mailboxBase, { recursive: true, force: true })
    process.exit(0)
})

let busy = false

function showPrompt() {
    if (!busy) rl.prompt()
}

rl.on('line', async (input) => {
    input = input.trim()
    if (!input) { showPrompt(); return }

    if (input === '/quit' || input === '/exit') {
        rl.close()
        return
    }

    if (input === '/status') {
        const { loadRegistry, getStatus } = await import('../lib/agent-mailbox.js')
        const registry = loadRegistry(mailboxBase)
        const agents = Object.entries(registry.agents)
        if (agents.length === 0) {
            console.log(`${DIM}📋 No workers registered${RESET}`)
        } else {
            for (const [id, info] of agents) {
                const status = getStatus(id, mailboxBase)
                const color = getWorkerColor(id)
                const statusEmoji = status?.status === 'complete' ? '✅' :
                    status?.status === 'error' ? '❌' :
                        status?.status === 'running' ? '🔄' : '❓'
                console.log(`  ${tag(id, color)} ${statusEmoji} ${info.task}`)
            }
        }
        showPrompt(); return
    }

    if (input === '/help') {
        console.log(`
${BOLD}Commands:${RESET}
  /status  — Show all workers and their statuses
  /quit    — Exit the playground
  /help    — Show this help

${BOLD}Example prompts:${RESET}
  "Spawn a worker to write a hello world script"
  "Check on the workers"
  "Ask the worker what it found"
`)
        showPrompt(); return
    }

    busy = true
    try {
        await master.prompt(input)
    } catch (err) {
        console.error(`\n❌ Error: ${err.message}`)
    }
    busy = false
    showPrompt()
})

// ── Main ──

console.log(`${BOLD}🧪 Playground: Master-Worker Communication${RESET}`)
console.log('━'.repeat(50))
console.log(`
This playground lets you interact with a master agent that can spawn workers.
Each worker gets a unique ${BOLD}color${RESET} in the output for easy identification.

Type ${BOLD}/help${RESET} for commands, or talk to the master agent.
`)

showPrompt()

