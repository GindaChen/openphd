// ── Agent system routes ──
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { readJSON, writeJSON } from '../lib/helpers.js'
import { getDataDir, ensureBootstrapped } from '../lib/project.js'
import { ghFetch, ENV_GITHUB_TOKEN, ENV_GITHUB_REPO } from './github-sync.js'
import { ENV_LLM_BASE_URL, ENV_LLM_API_KEY, ENV_LLM_MODEL } from './chat.js'
import { getOrCreateSession, listSessions, destroySession } from '../lib/agent-sessions.js'
import {
    readInbox, readOutbox, loadRegistry, getRegistrySnapshot, getStatus as getAgentStatus,
} from '../lib/agent-mailbox.js'
import { listAgents as listPersistedAgents, loadAgent as loadPersistedAgent, createAgent as createPersistedAgent, getAgentsBase, loadHistory as loadAgentHistory, saveHistory as saveAgentHistory, saveSoul, loadSoul, listSoulTemplates } from '../lib/agent-store.js'
import { generateAgentId } from '../lib/agent-id.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const AGENT_API_URL = process.env.AGENT_API_URL || ''
const DEFAULT_AGENT_DIR = process.env.AGENT_DATA_DIR || path.join(__dirname, '..', '..', '..', '.agents', 'agents')

function getAgentDataDir(req) {
    const root = req?.headers?.['x-project-root']
    if (root && path.isAbsolute(root)) return path.join(root, '.agents', 'agents')
    return DEFAULT_AGENT_DIR
}

function ensureAgentDirs(agentDir) {
    const memDir = path.join(agentDir, 'memory', 'shared')
    if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true })
    ensureMasterAgent(agentDir)
}

/** Seed a default master agent if none exists yet */
function ensureMasterAgent(agentsBase) {
    try {
        const existing = listPersistedAgents(agentsBase)
        if (existing.some(a => a.type === 'master')) return // already have one
        const result = createPersistedAgent({
            type: 'master',
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
        }, agentsBase)
        console.log(`🤖 [bootstrap] Seeded master agent: ${result.agentId}`)
    } catch (err) {
        console.error('⚠️  Failed to seed master agent:', err.message)
    }
}

// Ensure default agent dirs exist
ensureAgentDirs(DEFAULT_AGENT_DIR)

function loadAgentTasks(req) {
    const dir = getAgentDataDir(req)
    ensureAgentDirs(dir)
    const file = path.join(dir, 'tasks.json')
    try { return readJSON(file) } catch { return [] }
}
function saveAgentTasks(tasks, req) {
    const dir = getAgentDataDir(req)
    ensureAgentDirs(dir)
    writeJSON(path.join(dir, 'tasks.json'), tasks)
}
function loadAgentMemory(req) {
    const dir = getAgentDataDir(req)
    ensureAgentDirs(dir)
    const file = path.join(dir, 'memory', 'shared', 'entries.json')
    try { return readJSON(file) } catch { return [] }
}
function saveAgentMemory(entries, req) {
    const dir = getAgentDataDir(req)
    ensureAgentDirs(dir)
    const file = path.join(dir, 'memory', 'shared', 'entries.json')
    writeJSON(file, entries)
}

// Agent LLM tools (GitHub-aware)
const AGENT_LLM_TOOLS = [
    {
        type: 'function', function: {
            name: 'createGithubIssue',
            description: 'Create a GitHub issue in the configured repo',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    body: { type: 'string' },
                    labels: { type: 'array', items: { type: 'string' } },
                },
                required: ['title'],
            },
        },
    },
    {
        type: 'function', function: {
            name: 'commentOnIssue',
            description: 'Add a comment to a GitHub issue',
            parameters: {
                type: 'object',
                properties: {
                    issue_number: { type: 'number' },
                    body: { type: 'string' },
                },
                required: ['issue_number', 'body'],
            },
        },
    },
    {
        type: 'function', function: {
            name: 'saveMemory',
            description: 'Save a fact or learning to shared memory',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Unique key' },
                    content: { type: 'string', description: 'What to remember' },
                    tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['key', 'content'],
            },
        },
    },
    {
        type: 'function', function: {
            name: 'searchMemory',
            description: 'Search shared memory for relevant info',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function', function: {
            name: 'createTask',
            description: 'Queue a task for an agent to work on asynchronously',
            parameters: {
                type: 'object',
                properties: { goal: { type: 'string' } },
                required: ['goal'],
            },
        },
    },
]

function executeAgentTool(name, args, req) {
    switch (name) {
        case 'createGithubIssue': {
            if (!ENV_GITHUB_TOKEN || !ENV_GITHUB_REPO) return { error: 'GitHub not configured' }
            return { queued: true, title: args.title, note: 'Issue creation queued via GitHub API' }
        }
        case 'commentOnIssue': {
            if (!ENV_GITHUB_TOKEN || !ENV_GITHUB_REPO) return { error: 'GitHub not configured' }
            return { queued: true, issue: args.issue_number }
        }
        case 'saveMemory': {
            const entries = loadAgentMemory(req)
            const entry = { key: args.key, content: args.content, tags: args.tags || [], source: 'agent', timestamp: Date.now() / 1000 }
            const idx = entries.findIndex(e => e.key === args.key)
            if (idx >= 0) entries[idx] = entry; else entries.push(entry)
            saveAgentMemory(entries, req)
            return { saved: true, key: args.key }
        }
        case 'searchMemory': {
            const q = (args.query || '').toLowerCase()
            const entries = loadAgentMemory(req)
            return entries.filter(e => (e.content || '').toLowerCase().includes(q)).slice(0, 5)
        }
        case 'createTask': {
            const tasks = loadAgentTasks(req)
            const taskId = Math.random().toString(36).slice(2, 10)
            tasks.push({ task_id: taskId, status: 'pending', goal: args.goal, created_at: Date.now() / 1000 })
            saveAgentTasks(tasks, req)
            return { created: true, task_id: taskId }
        }
        default: return { error: `Unknown tool: ${name}` }
    }
}

async function executeAgentTask(goal) {
    const res = await fetch(`${ENV_LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ENV_LLM_API_KEY}` },
        body: JSON.stringify({
            model: ENV_LLM_MODEL,
            messages: [
                { role: 'system', content: 'You are an autonomous research agent. Execute the task and report results concisely.' },
                { role: 'user', content: goal },
            ],
        }),
    })
    if (!res.ok) throw new Error(`LLM error: ${res.status}`)
    const data = await res.json()
    return { summary: data.choices[0].message.content }
}

async function executeAgentChat(messages, req) {
    const memory = loadAgentMemory(req)
    const memoryStr = memory.slice(0, 10).map(m => `- [${m.key}] ${(m.content || '').slice(0, 100)}`).join('\n')
    const tasks = loadAgentTasks(req)

    const systemMsg = {
        role: 'system',
        content: `You are a research agent with memory and GitHub access.

Shared memory (${memory.length} entries):
${memoryStr || 'None yet.'}

Tasks: ${tasks.length} total, ${tasks.filter(t => t.status === 'running').length} running.
GitHub: ${ENV_GITHUB_REPO || 'not configured'}

Use tools to create issues, save memories, or queue tasks. Be concise and action-oriented.`,
    }

    let conversation = [systemMsg, ...messages]
    let maxIters = 5

    while (maxIters-- > 0) {
        const llmRes = await fetch(`${ENV_LLM_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ENV_LLM_API_KEY}` },
            body: JSON.stringify({ model: ENV_LLM_MODEL, messages: conversation, tools: AGENT_LLM_TOOLS, tool_choice: 'auto' }),
        })
        if (!llmRes.ok) throw new Error(`LLM API error ${llmRes.status}`)

        const data = await llmRes.json()
        const msg = data.choices[0].message

        if (!msg.tool_calls?.length) return msg.content || 'Done.'

        conversation.push(msg)
        for (const tc of msg.tool_calls) {
            const callArgs = JSON.parse(tc.function.arguments)

            if (tc.function.name === 'createGithubIssue' && ENV_GITHUB_TOKEN && ENV_GITHUB_REPO) {
                try {
                    const ghRes = await ghFetch(`/repos/${ENV_GITHUB_REPO}/issues`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: callArgs.title, body: callArgs.body || '', labels: callArgs.labels || [] }),
                    })
                    conversation.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ created: true, number: ghRes.number, url: ghRes.html_url }) })
                    continue
                } catch (err) {
                    conversation.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) })
                    continue
                }
            }
            if (tc.function.name === 'commentOnIssue' && ENV_GITHUB_TOKEN && ENV_GITHUB_REPO) {
                try {
                    await ghFetch(`/repos/${ENV_GITHUB_REPO}/issues/${callArgs.issue_number}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ body: callArgs.body }),
                    })
                    conversation.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ commented: true, issue: callArgs.issue_number }) })
                    continue
                } catch (err) {
                    conversation.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: err.message }) })
                    continue
                }
            }

            const result = executeAgentTool(tc.function.name, callArgs, req)
            conversation.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
        }
    }

    return 'Max iterations reached. Check tasks and memory for results.'
}

export { AGENT_API_URL, DEFAULT_AGENT_DIR as AGENT_DATA_DIR }

export default function agentRoutes(app) {
    // If AGENT_API_URL is set, proxy all agent requests to the remote orchestrator
    if (AGENT_API_URL) {
        app.all('/agents/*', async (req, res) => {
            try {
                const target = `${AGENT_API_URL}/api${req.path}`
                const fetchOpts = { method: req.method, headers: { 'Content-Type': 'application/json' } }
                if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                    fetchOpts.body = JSON.stringify(req.body)
                }
                const upstream = await fetch(target, fetchOpts)
                const data = await upstream.json()
                res.status(upstream.status).json(data)
            } catch (err) {
                res.status(502).json({ error: 'Agent API proxy failed', details: err.message })
            }
        })
    } else {
        // ── Local agent API implementation ──

        // GET /agents/list — list all persisted agents
        app.get('/agents/list', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const agents = listPersistedAgents(base)
            res.json(agents)
        })

        // GET /agents/detail/:id — single agent detail
        app.get('/agents/detail/:id', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const agent = loadPersistedAgent(req.params.id, base)
            if (!agent) return res.status(404).json({ error: 'Agent not found' })
            res.json(agent)
        })

        // GET /agents/detail/:id/history — agent chat history
        app.get('/agents/detail/:id/history', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const history = loadAgentHistory(req.params.id, base)
            res.json(history)
        })

        // GET /agents/detail/:id/soul — agent soul document
        app.get('/agents/detail/:id/soul', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const soul = loadSoul(req.params.id, base)
            res.json({ agentId: req.params.id, soul: soul || '' })
        })

        // PUT /agents/detail/:id/soul — save agent soul document
        app.put('/agents/detail/:id/soul', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const { soul } = req.body || {}
            if (typeof soul !== 'string') return res.status(400).json({ error: 'soul (string) required' })
            saveSoul(req.params.id, soul, base)
            res.json({ status: 'ok', agentId: req.params.id })
        })

        // GET /agents/soul-templates — list available soul templates
        app.get('/agents/soul-templates', (_req, res) => {
            const templates = listSoulTemplates()
            res.json(templates)
        })

        // POST /agents/detail/:id/soul/fork — fork a soul template for an agent
        app.post('/agents/detail/:id/soul/fork', (req, res) => {
            const root = req.headers['x-project-root']
            const base = getAgentsBase(root)
            const { templateName } = req.body || {}
            const templates = listSoulTemplates()
            const tpl = templates.find(t => t.name === templateName)
            if (!tpl) return res.status(404).json({ error: `Template '${templateName}' not found` })

            // Personalize the template with agent info
            const agent = loadPersistedAgent(req.params.id, base)
            let soul = tpl.content
            if (agent) {
                soul = soul.replace(/\{\{agentId\}\}/g, agent.agentId || req.params.id)
                soul = soul.replace(/\{\{displayName\}\}/g, agent.displayName || agent.agentId)
                soul = soul.replace(/\{\{workspace\}\}/g, agent.workspace || '(none)')
                soul = soul.replace(/\{\{model\}\}/g, agent.model || 'unknown')
            }
            saveSoul(req.params.id, soul, base)
            res.json({ status: 'ok', agentId: req.params.id, template: templateName })
        })

        // GET /agents/tools — list available tool categories and tools
        app.get('/agents/tools', (_req, res) => {
            const toolsDir = path.join(__dirname, '..', 'lib', 'tools')
            const categories = []
            try {
                const entries = fs.readdirSync(toolsDir, { withFileTypes: true })
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const catDir = path.join(toolsDir, entry.name)
                        const tools = fs.readdirSync(catDir)
                            .filter(f => f.endsWith('.js'))
                            .map(f => f.replace('.js', ''))
                        categories.push({ category: entry.name, tools })
                    }
                }
            } catch { /* ignore */ }
            // Also include top-level tools (AGENT_LLM_TOOLS)
            const agentTools = AGENT_LLM_TOOLS.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters,
            }))
            res.json({ categories, agentTools })
        })

        // POST /agents/create — create a new persistent agent (auto-named)
        app.post('/agents/create', (req, res) => {
            try {
                const root = req.headers['x-project-root']
                const base = getAgentsBase(root)
                const { type = 'workspace', workspace = null, parentId = null } = req.body || {}

                const result = createPersistedAgent({
                    type,
                    workspace,
                    parentId,
                    provider: req.headers['x-llm-provider'] || 'anthropic',
                    model: req.headers['x-llm-model'] || 'claude-sonnet-4-6',
                }, base)

                console.log(`🤖 [create] New agent: ${result.agentId} (type=${type}, workspace=${workspace})`)
                res.status(201).json(result.config)
            } catch (err) {
                res.status(500).json({ error: err.message })
            }
        })

        // GET /agents/fleet
        app.get('/agents/fleet', (req, res) => {
            const tasks = loadAgentTasks(req)
            const memory = loadAgentMemory(req)
            const running = tasks.filter(t => t.status === 'running')
            const root = req.headers['x-project-root']
            const agents = listPersistedAgents(getAgentsBase(root))
            res.json({
                total_tasks: tasks.length,
                running: running.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                failed: tasks.filter(t => t.status === 'failed').length,
                pending: tasks.filter(t => t.status === 'pending').length,
                memory_entries: memory.length,
                agents: agents.length,
                active_agents: running.map(t => ({ task_id: t.task_id, goal: t.goal })),
            })
        })

        // GET /agents/tasks
        app.get('/agents/tasks', (req, res) => {
            const tasks = loadAgentTasks(req)
            const filtered = req.query.status
                ? tasks.filter(t => t.status === req.query.status)
                : tasks
            res.json(filtered.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 50))
        })

        // POST /agents/tasks — create and optionally execute a task
        app.post('/agents/tasks', async (req, res) => {
            const tasks = loadAgentTasks(req)
            const taskId = Math.random().toString(36).slice(2, 10)
            const now = Date.now() / 1000
            const task = {
                task_id: taskId,
                status: 'pending',
                goal: req.body.goal || '',
                agent_id: req.body.agent_id || null,
                created_at: now,
                started_at: null,
                completed_at: null,
                result: null,
                error: null,
            }
            tasks.push(task)
            saveAgentTasks(tasks, req)

            if (ENV_LLM_API_KEY) {
                task.status = 'running'
                task.started_at = Date.now() / 1000
                saveAgentTasks(tasks, req)

                try {
                    const result = await executeAgentTask(task.goal)
                    task.status = 'completed'
                    task.result = result
                    task.completed_at = Date.now() / 1000
                } catch (err) {
                    task.status = 'failed'
                    task.error = err.message
                    task.completed_at = Date.now() / 1000
                }
                saveAgentTasks(tasks, req)
            }

            res.status(201).json(task)
        })

        // GET /agents/tasks/:id
        app.get('/agents/tasks/:id', (req, res) => {
            const tasks = loadAgentTasks(req)
            const task = tasks.find(t => t.task_id === req.params.id)
            if (!task) return res.status(404).json({ error: 'Task not found' })
            res.json(task)
        })

        // GET /agents/memory
        app.get('/agents/memory', (req, res) => {
            const entries = loadAgentMemory(req)
            res.json(entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50))
        })

        // POST /agents/memory
        app.post('/agents/memory', (req, res) => {
            const entries = loadAgentMemory(req)
            const entry = {
                key: req.body.key,
                content: req.body.content,
                tags: req.body.tags || [],
                source: req.body.source || 'user',
                timestamp: Date.now() / 1000,
                namespace: 'shared',
            }
            const idx = entries.findIndex(e => e.key === entry.key)
            if (idx >= 0) entries[idx] = entry
            else entries.push(entry)
            saveAgentMemory(entries, req)
            res.json({ status: 'ok', key: entry.key })
        })

        // GET /agents/memory/search
        app.get('/agents/memory/search', (req, res) => {
            const q = (req.query.q || '').toLowerCase()
            const entries = loadAgentMemory(req)
            const results = entries.filter(e =>
                (e.key || '').toLowerCase().includes(q) ||
                (e.content || '').toLowerCase().includes(q) ||
                (e.tags || []).some(t => t.toLowerCase().includes(q))
            ).slice(0, parseInt(req.query.limit) || 10)
            res.json(results)
        })

        // GET /agents/status
        app.get('/agents/status', (req, res) => {
            const headerKey = req.headers['x-llm-api-key']
            const headerModel = req.headers['x-llm-model']
            const apiKey = headerKey || ENV_LLM_API_KEY
            const ghToken = req.headers['x-github-token'] || ENV_GITHUB_TOKEN
            const ghRepo = req.headers['x-github-repo'] || ENV_GITHUB_REPO
            res.json({
                configured: !!apiKey,
                github: !!(ghToken && ghRepo),
                model: headerModel || ENV_LLM_MODEL,
                repo: ghRepo || null,
            })
        })

        // POST /agents/chat — dispatch tasks via natural language (non-streaming)
        app.post('/agents/chat', async (req, res) => {
            const { messages, sessionId: sid } = req.body || {}
            if (!messages?.length) return res.json({ role: 'assistant', content: 'Send me a message!' })

            const userMsg = messages[messages.length - 1]?.content || ''
            const apiKey = req.headers['x-llm-api-key'] || process.env.ANTHROPIC_API_KEY || ENV_LLM_API_KEY

            if (!apiKey) {
                const tasks = loadAgentTasks(req)
                const taskId = Math.random().toString(36).slice(2, 10)
                tasks.push({
                    task_id: taskId, status: 'pending', goal: userMsg,
                    created_at: Date.now() / 1000, started_at: null, completed_at: null,
                    result: null, error: null, agent_id: null,
                })
                saveAgentTasks(tasks, req)
                return res.json({ role: 'assistant', content: `📋 Task \`${taskId}\` queued: "${userMsg}"\n\nNo LLM configured — set **ANTHROPIC_API_KEY** to enable.` })
            }

            try {
                const sessionId = sid || generateAgentId()
                const session = getOrCreateSession(sessionId, { apiKey })

                // Collect response text
                let responseText = ''
                const unsub = session.agent.subscribe(event => {
                    if (event.type === 'message_end' && event.message.role === 'assistant') {
                        const text = event.message.content
                            ?.filter(c => c.type === 'text')
                            ?.map(c => c.text)
                            ?.join('') || ''
                        if (text) responseText = text
                    }
                })

                await session.agent.prompt(userMsg)
                unsub?.()

                res.json({ role: 'assistant', content: responseText || 'Done.', sessionId })
            } catch (err) {
                res.json({ role: 'assistant', content: `❌ Error: ${err.message}` })
            }
        })

        // POST /agents/chat/stream — SSE streaming agent chat
        app.post('/agents/chat/stream', async (req, res) => {
            const { message, sessionId: sid } = req.body || {}
            if (!message) return res.status(400).json({ error: 'No message provided' })

            const apiKey = req.headers['x-llm-api-key'] || process.env.ANTHROPIC_API_KEY || ENV_LLM_API_KEY
            const provider = req.headers['x-llm-provider'] || 'anthropic'
            const modelId = req.headers['x-llm-model'] || ENV_LLM_MODEL || 'claude-sonnet-4-6'
            const baseUrl = req.headers['x-llm-base-url'] || ENV_LLM_BASE_URL || undefined

            console.log('\n🗨️  [chat/stream] incoming request:')
            console.log('   message:', JSON.stringify(message).slice(0, 100))
            console.log('   provider:', provider)
            console.log('   model:', modelId)
            console.log('   apiKey:', apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '(none)')
            console.log('   baseUrl:', baseUrl || '(default)')
            console.log('   sessionId:', sid || '(new)')

            if (!apiKey) return res.status(400).json({ error: 'No API key configured. Set your API key in Settings.' })

            const sessionId = sid || generateAgentId()

            // SSE headers
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            res.setHeader('X-Session-Id', sessionId)
            res.flushHeaders()

            let closed = false
            let lastAssistantText = ''
            let lastThinkingText = ''
            let toolCallResults = []   // { tool, args, result }
            let userMessage = message
            res.on('close', () => {
                closed = true
                console.log(`🔌 [${sessionId}] client disconnected`)
                // Save partial response to chat history so it's visible after refresh
                if (lastAssistantText) {
                    const historyPath = getDataDir(req)
                    if (historyPath) {
                        try {
                            const histFile = path.join(historyPath, 'chat-history.json')
                            let history = []
                            try { history = JSON.parse(fs.readFileSync(histFile, 'utf-8')) } catch { }
                            history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() })
                            history.push({ role: 'assistant', content: lastAssistantText, timestamp: new Date().toISOString() })
                            if (history.length > 200) history.splice(0, history.length - 200)
                            fs.writeFileSync(histFile, JSON.stringify(history, null, 2))
                            console.log(`💾 [${sessionId}] saved partial response to chat history`)
                        } catch (e) {
                            console.error(`⚠️  [${sessionId}] failed to save partial response:`, e.message)
                        }
                    }
                }
            })

            const send = (eventType, data) => {
                if (closed) return
                res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
            }

            try {
                const session = getOrCreateSession(sessionId, { apiKey, provider, modelId, baseUrl })
                const tag = `[${session.agentId || sessionId}]`

                console.log(`\n🟢 ${tag} session ready (new=${!sid})`)

                send('session', { sessionId, agentId: session.agentId })

                const unsub = session.agent.subscribe(event => {
                    console.log(`📄 ${tag} event: ${event.type}`, event);
                    switch (event.type) {
                        case 'agent_start':
                            console.log(`⚙️  ${tag} agent_start — processing`)
                            send('agent_start', { status: 'processing' })
                            break
                        case 'tool_execution_start':
                            console.log(`🔧 ${tag} tool_start: ${event.toolName}(${JSON.stringify(event.args || {}).slice(0, 120)})`)
                            toolCallResults.push({ tool: event.toolName, args: event.args, result: null })
                            send('tool_start', {
                                toolName: event.toolName,
                                args: event.args,
                            })
                            break
                        case 'tool_execution_end':
                            {
                                const resultPreview = event.result?.content?.[0]?.text || ''
                                console.log(`✅ ${tag} tool_end: ${event.toolName} → ${resultPreview.slice(0, 100)}${resultPreview.length > 100 ? '…' : ''}`)
                                const tc = toolCallResults.findLast(t => t.tool === event.toolName && !t.result)
                                if (tc) tc.result = resultPreview
                                send('tool_end', {
                                    toolName: event.toolName,
                                    result: resultPreview,
                                })
                            }
                            break
                        case 'message_start':
                            console.log(`💬 ${tag} message_start (role=${event.message?.role || '?'})`)
                            break
                        case 'message_update':
                            {
                                // pi-mono wraps streaming content in assistantMessageEvent
                                const ame = event.assistantMessageEvent
                                if (!ame) break
                                switch (ame.type) {
                                    case 'thinking_start':
                                        console.log(`🧠 ${tag} thinking...`)
                                        lastThinkingText = ''
                                        send('thinking_start', {})
                                        break
                                    case 'thinking_delta':
                                        if (ame.delta) {
                                            lastThinkingText += ame.delta
                                            send('thinking_delta', { text: ame.delta })
                                        }
                                        break
                                    case 'thinking_end':
                                        console.log(`🧠 ${tag} thinking complete`)
                                        send('thinking_end', { content: ame.content || '' })
                                        break
                                    case 'text_start':
                                        break
                                    case 'text_delta':
                                        if (ame.delta) {
                                            lastAssistantText += ame.delta
                                            send('content', { text: ame.delta })
                                        }
                                        break
                                    case 'text_end':
                                        console.log(`📝 ${tag} text_end: ${lastAssistantText.slice(0, 120)}${lastAssistantText.length > 120 ? '…' : ''}`)
                                        break
                                }
                            }
                            break
                        case 'message_end':
                            if (event.message?.role === 'assistant') {
                                const text = event.message.content
                                    ?.filter(c => c.type === 'text')
                                    ?.map(c => c.text)
                                    ?.join('') || ''
                                if (text) lastAssistantText = text
                                console.log(`📨 ${tag} message_end (${text.length} chars)`)
                                // Send full message as final — frontend uses this to finalize
                                if (text) send('message', { role: 'assistant', content: text })
                            }
                            break
                        case 'turn_start':
                            console.log(`🔄 ${tag} turn_start`)
                            break
                        case 'turn_end':
                            console.log(`🔄 ${tag} turn_end`)
                            break
                        case 'agent_end':
                            console.log(`🏁 ${tag} agent_end — idle`)
                            send('agent_end', { status: 'idle' })
                            break
                        default:
                            console.log(`❓ ${tag} unknown event: ${event.type}`)
                            break
                    }
                })

                // Emit the full prompt context for debug mode
                const agentState = session.agent._state
                send('prompt_debug', {
                    systemPrompt: agentState.systemPrompt || '',
                    messages: (agentState.messages || []).map(m => ({
                        role: m.role,
                        content: typeof m.content === 'string' ? m.content
                            : m.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '',
                    })),
                    userMessage: message,
                    model: agentState.model || null,
                    toolCount: agentState.tools?.length || 0,
                })

                console.log(`🚀 ${tag} prompt("${message.slice(0, 80)}${message.length > 80 ? '…' : ''}")`)
                await session.agent.prompt(message)
                unsub?.()

                console.log(`✔️  ${tag} prompt complete, closing stream`)

                // Save to per-agent history (with thinking + tool calls)
                if (session.agentId) {
                    try {
                        const agentsBase = getAgentsBase(req.headers['x-project-root'])
                        const history = loadAgentHistory(session.agentId, agentsBase)
                        history.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() })
                        const assistantEntry = {
                            role: 'assistant',
                            content: lastAssistantText || '',
                            timestamp: new Date().toISOString(),
                        }
                        if (lastThinkingText) assistantEntry.thinking = lastThinkingText
                        if (toolCallResults.length > 0) assistantEntry.toolCalls = toolCallResults
                        history.push(assistantEntry)
                        if (history.length > 200) history.splice(0, history.length - 200)
                        saveAgentHistory(session.agentId, history, agentsBase)
                    } catch (err) {
                        console.error(`⚠️  Failed to save agent history: ${err.message}`)
                    }
                }

                send('done', { sessionId })
                res.end()
            } catch (err) {
                console.error('❌ [chat/stream] error:', err.message)
                console.error('   stack:', err.stack?.split('\n').slice(0, 3).join('\n   '))
                send('error', { message: err.message })
                res.end()
            }
        })

        // POST /agents/workspace — spawn a workspace agent
        app.post('/agents/workspace', async (req, res) => {
            try {
                const { workspace, issues = [], sessionId: parentSessionId } = req.body
                if (!workspace) return res.status(400).json({ error: 'workspace name required' })

                const { createWorkspaceAgent } = await import('../lib/agent-engine.js')
                const { registerAgent, createMailbox } = await import('../lib/agent-mailbox.js')

                const agentId = `ws-${workspace}-${Date.now().toString(36)}`

                // Find parent session's mailbox or use a shared one
                let mailboxBase
                if (parentSessionId) {
                    const parentSession = getOrCreateSession(parentSessionId)
                    mailboxBase = parentSession.mailboxBase
                } else {
                    const os = await import('os')
                    mailboxBase = path.join(os.default.tmpdir(), 'agent-sessions', 'shared')
                    fs.mkdirSync(mailboxBase, { recursive: true })
                }

                createMailbox(agentId, mailboxBase)
                registerAgent(agentId, {
                    type: 'workspace-main',
                    workspace,
                    issues,
                    parentAgent: 'master',
                    status: 'running',
                }, mailboxBase)

                const apiKey = req.headers['x-llm-api-key'] || ENV_LLM_API_KEY
                const agent = createWorkspaceAgent({
                    agentId,
                    mailboxBase,
                    workspace,
                    issues,
                    apiKey,
                })

                // Store as a session so it can be reached via /agents/chat/stream
                const session = {
                    sessionId: agentId,
                    agent,
                    mailboxBase,
                    createdAt: Date.now(),
                    lastAccess: Date.now(),
                }
                // Reuse the sessions map — import it from agent-sessions
                // For now, just respond with creation info
                res.json({
                    agentId,
                    workspace,
                    issues,
                    mailboxBase,
                    status: 'running',
                })
            } catch (err) {
                res.status(500).json({ error: err.message })
            }
        })

        // GET /agents/queue — read the combined message feed for a session's agents
        // Query: ?sessionId=X&after=N (cursor-based pagination)
        app.get('/agents/queue', (req, res) => {
            const { sessionId, after = '0' } = req.query
            if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

            // Look up session to find its mailboxBase
            const allSessions = listSessions()
            const sessionInfo = allSessions.find(s => s.sessionId === sessionId)
            if (!sessionInfo) {
                return res.json({ messages: [], cursor: 0, agents: [] })
            }

            try {
                // Get the session object to access mailboxBase
                const session = getOrCreateSession(sessionId)
                const base = session.mailboxBase

                const registry = loadRegistry(base)
                const messages = []

                for (const [agentId] of Object.entries(registry.agents || {})) {
                    const inbox = readInbox(agentId, 0, base)
                    const outbox = readOutbox(agentId, 0, base)
                    for (const m of inbox.messages) {
                        messages.push({ ...m, direction: 'in', agentId })
                    }
                    for (const m of outbox.messages) {
                        messages.push({ ...m, direction: 'out', agentId })
                    }
                }

                // Sort by timestamp
                messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

                // Paginate after cursor
                const afterN = parseInt(after) || 0
                const filtered = messages.slice(afterN)

                const agents = getRegistrySnapshot(base)
                res.json({ messages: filtered, cursor: messages.length, agents })
            } catch (err) {
                res.json({ messages: [], cursor: 0, agents: [], error: err.message })
            }
        })

        // GET /agents/sessions — list active agent sessions
        app.get('/agents/sessions', (req, res) => {
            res.json(listSessions())
        })

        // DELETE /agents/sessions/:id — destroy a session
        app.delete('/agents/sessions/:id', (req, res) => {
            const destroyed = destroySession(req.params.id)
            res.json({ destroyed, sessionId: req.params.id })
        })
    }
}

