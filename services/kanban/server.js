// ── Kanban API Server ──
// Thin bootstrap — all logic lives in lib/ and routes/

import express from 'express'
import { ensureBootstrapped, DEFAULT_DATA_DIR } from './lib/project.js'
import issueRoutes from './routes/issues.js'
import githubSyncRoutes, { ENV_GITHUB_TOKEN, ENV_GITHUB_REPO } from './routes/github-sync.js'
import chatRoutes, { ENV_LLM_API_KEY, ENV_LLM_MODEL, ENV_LLM_BASE_URL } from './routes/chat.js'
import agentRoutes, { AGENT_API_URL, AGENT_DATA_DIR } from './routes/agents.js'

const app = express()
app.use(express.json())

// Ensure default data directory exists on startup
ensureBootstrapped(DEFAULT_DATA_DIR)

// Mount route modules
issueRoutes(app)
githubSyncRoutes(app)
chatRoutes(app)
agentRoutes(app)

// ── Start ──
const STRICT_MODE = process.argv.includes('--strict')
const BASE_PORT = parseInt(process.env.KANBAN_PORT || '3001', 10)
const MAX_PORT_ATTEMPTS = 10

function printBanner(port) {
    console.log(`📋 Kanban API running at http://localhost:${port}`)
    console.log(`   Data dir: ${DEFAULT_DATA_DIR} (override via browser Settings or X-Project-Root header)`)
    console.log(`   GitHub: ${ENV_GITHUB_TOKEN ? `${ENV_GITHUB_REPO || '(no repo set)'}` : 'not configured (set in Settings or GITHUB_TOKEN)'}`)
    console.log(`   LLM: ${ENV_LLM_API_KEY ? `${ENV_LLM_MODEL} via ${ENV_LLM_BASE_URL}` : 'not configured (set in Settings or LLM_API_KEY)'}`)
    console.log(`   Agents: ${AGENT_API_URL ? `remote → ${AGENT_API_URL}` : `local → ${AGENT_DATA_DIR}`}`)
    console.log(`   💡 Tokens can also be configured from the frontend Settings panel`)
}

function tryListen(port, attempt = 0) {
    const server = app.listen(port)
    server.on('listening', () => printBanner(port))
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (STRICT_MODE) {
                console.error(`❌ Port ${port} is already in use. Aborting (--strict mode).`)
                console.error(`   Hint: kill the process on port ${port} or set KANBAN_PORT to a different value.`)
                process.exit(1)
            }
            if (attempt >= MAX_PORT_ATTEMPTS) {
                console.error(`❌ Ports ${BASE_PORT}–${port} are all in use. Giving up after ${MAX_PORT_ATTEMPTS} attempts.`)
                process.exit(1)
            }
            const nextPort = port + 1
            console.warn(`⚠️  Port ${port} in use, trying ${nextPort}…`)
            tryListen(nextPort, attempt + 1)
        } else {
            console.error(`❌ Server error: ${err.message}`)
            process.exit(1)
        }
    })
}

tryListen(BASE_PORT)
