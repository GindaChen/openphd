// ── Agent system routes ──
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { readJSON, writeJSON } from '../lib/helpers.js'
import { ghFetch, ENV_GITHUB_TOKEN, ENV_GITHUB_REPO } from './github-sync.js'
import { ENV_LLM_BASE_URL, ENV_LLM_API_KEY, ENV_LLM_MODEL } from './chat.js'
import { getOrCreateSession, listSessions, destroySession } from '../lib/agent-sessions.js'
import {
    readInbox, readOutbox, loadRegistry, getRegistrySnapshot, getStatus as getAgentStatus,
} from '../lib/agent-mailbox.js'

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

        // GET /agents/fleet
        app.get('/agents/fleet', (req, res) => {
            const tasks = loadAgentTasks(req)
            const memory = loadAgentMemory(req)
            const running = tasks.filter(t => t.status === 'running')
            res.json({
                total_tasks: tasks.length,
                running: running.length,
                completed: tasks.filter(t => t.status === 'completed').length,
                failed: tasks.filter(t => t.status === 'failed').length,
                pending: tasks.filter(t => t.status === 'pending').length,
                memory_entries: memory.length,
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
                const sessionId = sid || crypto.randomUUID()
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
            if (!apiKey) return res.status(400).json({ error: 'No API key configured. Set ANTHROPIC_API_KEY.' })

            const sessionId = sid || crypto.randomUUID()

            // SSE headers
            res.setHeader('Content-Type', 'text/event-stream')
            res.setHeader('Cache-Control', 'no-cache')
            res.setHeader('Connection', 'keep-alive')
            res.setHeader('X-Session-Id', sessionId)
            res.flushHeaders()

            const send = (eventType, data) => {
                res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
            }

            try {
                const session = getOrCreateSession(sessionId, { apiKey })

                send('session', { sessionId })

                const unsub = session.agent.subscribe(event => {
                    switch (event.type) {
                        case 'agent_start':
                            send('agent_start', { status: 'processing' })
                            break
                        case 'tool_execution_start':
                            send('tool_start', {
                                toolName: event.toolName,
                                args: event.args,
                            })
                            break
                        case 'tool_execution_end':
                            send('tool_end', {
                                toolName: event.toolName,
                                result: event.result?.content?.[0]?.text || '',
                            })
                            break
                        case 'message_end':
                            if (event.message.role === 'assistant') {
                                const text = event.message.content
                                    ?.filter(c => c.type === 'text')
                                    ?.map(c => c.text)
                                    ?.join('') || ''
                                if (text) send('message', { role: 'assistant', content: text })
                            }
                            break
                        case 'agent_end':
                            send('agent_end', { status: 'idle' })
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

                await session.agent.prompt(message)
                unsub?.()

                send('done', { sessionId })
                res.end()
            } catch (err) {
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

