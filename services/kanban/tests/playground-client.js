#!/usr/bin/env node
// ── Playground Client: talks to the kanban server's agent SSE endpoint ──
// No more stdin conflicts — agent runs server-side, we just send HTTP.
//
// Usage:
//   1. Start the server:  ANTHROPIC_API_KEY=<key> node services/kanban/server.js
//   2. Run this client:   node services/kanban/tests/playground-client.js
//
// Options:
//   --url http://localhost:3001   (server URL, default: http://localhost:3001)

import readline from 'readline'

// ── Config ──
const urlFlagIdx = process.argv.indexOf('--url')
const SERVER_URL = process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
    || (urlFlagIdx > -1 ? process.argv[urlFlagIdx + 1] : null)
    || 'http://localhost:3001'
let sessionId = null

// ── ANSI Colors ──
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'
const RED = '\x1b[91m'

// ── SSE Parser ──
async function sendMessage(message) {
    const body = { message }
    if (sessionId) body.sessionId = sessionId

    const res = await fetch(`${SERVER_URL}/agents/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.text()
        console.error(`${RED}❌ Server error ${res.status}: ${err}${RESET}`)
        return
    }

    // Read SSE stream
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        let eventType = null
        for (const line of lines) {
            if (line.startsWith('event: ')) {
                eventType = line.slice(7)
            } else if (line.startsWith('data: ') && eventType) {
                try {
                    const data = JSON.parse(line.slice(6))
                    handleEvent(eventType, data)
                } catch { }
                eventType = null
            }
        }
    }
}

function handleEvent(type, data) {
    switch (type) {
        case 'session':
            sessionId = data.sessionId
            console.log(`${DIM}📎 Session: ${sessionId}${RESET}`)
            break
        case 'agent_start':
            console.log(`${CYAN}🟢 Processing...${RESET}`)
            break
        case 'tool_start':
            console.log(`${YELLOW}🔧 ${data.toolName}(${JSON.stringify(data.args).slice(0, 120)})${RESET}`)
            break
        case 'tool_end':
            console.log(`${GREEN}✅ ${data.result.slice(0, 200)}${data.result.length > 200 ? '...' : ''}${RESET}`)
            break
        case 'message': {
            const lines = data.content.split('\n')
            for (const line of lines) {
                console.log(`${MAGENTA}💬 ${line}${RESET}`)
            }
            break
        }
        case 'agent_end':
            console.log(`${DIM}⏸️  Idle${RESET}`)
            break
        case 'error':
            console.error(`${RED}❌ ${data.message}${RESET}`)
            break
        case 'done':
            break
    }
}

// ── REPL ──
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '👤 You: ',
})

rl.on('close', () => {
    console.log('\n👋 Goodbye!')
    process.exit(0)
})

let busy = false

rl.on('line', async (input) => {
    input = input.trim()
    if (!input) { if (!busy) rl.prompt(); return }

    if (input === '/quit') { rl.close(); return }
    if (input === '/session') {
        console.log(sessionId ? `📎 Session: ${sessionId}` : 'No session yet')
        rl.prompt(); return
    }
    if (input === '/new') {
        sessionId = null
        console.log('🔄 New session (next message will create one)')
        rl.prompt(); return
    }
    if (input === '/workers') {
        if (!sessionId) { console.log(`${DIM}No session yet — send a message first${RESET}`); rl.prompt(); return }
        try {
            const res = await fetch(`${SERVER_URL}/agents/sessions`)
            const sessions = await res.json()
            const s = sessions.find(s => s.sessionId === sessionId)
            if (!s) { console.log(`${DIM}Session not found on server${RESET}`); rl.prompt(); return }

            // Ask the master agent to list workers via the tool
            console.log(`${DIM}Asking master to list workers...${RESET}`)
            await sendMessage('/workers — List all spawned workers and their status')
        } catch (err) {
            console.error(`${RED}❌ ${err.message}${RESET}`)
        }
        rl.prompt(); return
    }
    if (input === '/help') {
        console.log(`
${BOLD}Commands:${RESET}
  /session  — Show current session ID
  /workers  — List all workers (asks master to use listWorkers tool)
  /new      — Start a new session
  /quit     — Exit

Just type a message and hit Enter to talk to the agent.
`)
        rl.prompt(); return
    }

    busy = true
    try {
        await sendMessage(input)
    } catch (err) {
        console.error(`${RED}❌ ${err.message}${RESET}`)
        if (err.cause?.code === 'ECONNREFUSED') {
            console.error(`${DIM}   Is the server running? Start it with: node services/kanban/server.js${RESET}`)
        }
    }
    busy = false
    rl.prompt()
})

// ── Health Check + Main ──

async function healthCheck() {
    console.log(`${BOLD}🧪 Agent Client${RESET}`)
    console.log('━'.repeat(40))
    console.log(`${DIM}Server: ${SERVER_URL}${RESET}`)

    try {
        const res = await fetch(`${SERVER_URL}/agents/status`, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const status = await res.json()
        console.log(`${GREEN}✅ Connected${RESET}`)
        console.log(`   LLM: ${status.configured ? `${GREEN}configured${RESET} (${status.model})` : `${RED}not configured${RESET} — set ANTHROPIC_API_KEY`}`)
        if (status.github) console.log(`   GitHub: ${GREEN}${status.repo}${RESET}`)
        return true
    } catch (err) {
        const msg = err.cause?.code === 'ECONNREFUSED' ? 'Connection refused' : err.message
        console.error(`${RED}❌ Cannot reach server: ${msg}${RESET}`)
        console.error(`${DIM}   Start it with: ANTHROPIC_API_KEY=<key> node services/kanban/server.js${RESET}`)
        return false
    }
}

async function main() {
    const ok = await healthCheck()
    if (!ok) process.exit(1)
    console.log(`\nType a message to talk to the agent, ${BOLD}/help${RESET} for commands.\n`)
    rl.prompt()
}

main()

