// ── LLM Chat routes (kanban-aware tool calling) ──
import fs from 'fs'
import path from 'path'
import { readJSON, writeJSON, readMD, writeMD } from '../lib/helpers.js'
import { getDataDir, getIssuesDir, ensureBootstrapped, loadIssue, loadAllIssues, getNextId } from '../lib/project.js'
import { ghFetch, ENV_GITHUB_TOKEN, ENV_GITHUB_REPO } from './github-sync.js'

const ENV_LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1'
const ENV_LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || ''
const ENV_LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'

// ── Chat history persistence ──

function getChatHistoryPath(req) {
    const dataDir = getDataDir(req)
    ensureBootstrapped(dataDir)
    return path.join(dataDir, 'chat-history.json')
}

function loadChatHistory(req) {
    const file = getChatHistoryPath(req)
    try { return readJSON(file) } catch { return [] }
}

function saveChatHistory(messages, req) {
    writeJSON(getChatHistoryPath(req), messages)
}

function getLLMConfig(req) {
    return {
        apiKey: req.headers['x-llm-api-key'] || ENV_LLM_API_KEY,
        model: req.headers['x-llm-model'] || ENV_LLM_MODEL,
        baseUrl: req.headers['x-llm-base-url'] || ENV_LLM_BASE_URL,
    }
}

// ── Unified tool set (kanban + agent capabilities) ──

const ALL_TOOLS = [
    // Kanban tools
    {
        type: 'function',
        function: {
            name: 'createIssue',
            description: 'Create a new kanban issue',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Issue title' },
                    status: { type: 'string', enum: ['backlog', 'ideation', 'in-progress', 'blocked', 'review', 'done'] },
                    priority: { type: 'string', enum: ['none', 'low', 'medium', 'high', 'critical'] },
                    labels: { type: 'array', items: { type: 'string' } },
                },
                required: ['title'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'moveIssue',
            description: 'Move an issue to a different column/status',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Issue ID' },
                    status: { type: 'string', enum: ['backlog', 'ideation', 'in-progress', 'blocked', 'review', 'done'] },
                },
                required: ['id', 'status'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listIssues',
            description: 'List all issues, optionally filtered by status',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', description: 'Filter by status (optional)' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'boardSummary',
            description: 'Get a summary of the kanban board with issue counts per column',
            parameters: { type: 'object', properties: {} },
        },
    },
    // Agent tools — memory & tasks
    {
        type: 'function',
        function: {
            name: 'saveMemory',
            description: 'Save a fact, learning, or note to persistent shared memory',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string', description: 'Unique key for this memory entry' },
                    content: { type: 'string', description: 'The content to remember' },
                    tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['key', 'content'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchMemory',
            description: 'Search shared memory for relevant information',
            parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'createGithubIssue',
            description: 'Create a GitHub issue in the configured repository',
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
        type: 'function',
        function: {
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
]

// ── Memory helpers (shared with agents.js) ──

function getAgentMemoryPath(req) {
    const root = req?.headers?.['x-project-root']
    const baseDir = (root && path.isAbsolute(root))
        ? path.join(root, '.agents', 'agents', 'memory', 'shared')
        : path.join(getDataDir(req), '..', '..', '.agents', 'agents', 'memory', 'shared')
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
    return path.join(baseDir, 'entries.json')
}

function loadMemory(req) {
    try { return readJSON(getAgentMemoryPath(req)) } catch { return [] }
}
function saveMemory(entries, req) {
    writeJSON(getAgentMemoryPath(req), entries)
}

// ── Unified tool execution ──

async function executeToolCall(name, args, req) {
    switch (name) {
        case 'createIssue': {
            const issuesDir = getIssuesDir(req)
            ensureBootstrapped(getDataDir(req))
            const id = getNextId(req)
            const now = new Date().toISOString()
            const issue = {
                id, title: args.title || 'Untitled',
                status: args.status || 'backlog', priority: args.priority || 'none',
                labels: args.labels || [], contextualInfo: {}, artifacts: [],
                relationships: [], chatMessages: [], createdAt: now, updatedAt: now,
            }
            writeJSON(path.join(issuesDir, `${id}.json`), issue)
            writeMD(path.join(issuesDir, `${id}.md`), `# ${issue.title}\n\n(No description yet)\n`)
            return { success: true, issue: { id, title: issue.title, status: issue.status } }
        }
        case 'moveIssue': {
            const issuesDir = getIssuesDir(req)
            const jsonPath = path.join(issuesDir, `${args.id}.json`)
            if (!fs.existsSync(jsonPath)) return { error: `Issue #${args.id} not found` }
            const issue = readJSON(jsonPath)
            issue.status = args.status
            issue.updatedAt = new Date().toISOString()
            writeJSON(jsonPath, issue)
            return { success: true, id: args.id, newStatus: args.status }
        }
        case 'listIssues': {
            let issues = loadAllIssues(req)
            if (args.status) issues = issues.filter(i => i.status === args.status)
            return issues.map(i => ({ id: i.id, title: i.title, status: i.status, priority: i.priority, labels: i.labels }))
        }
        case 'boardSummary': {
            const dataDir = getDataDir(req)
            const issues = loadAllIssues(req)
            const board = readJSON(path.join(dataDir, 'board.json'))
            const summary = board.columns.map(c => ({
                column: c.label, emoji: c.emoji, count: issues.filter(i => i.status === c.id).length,
            }))
            return { total: issues.length, columns: summary }
        }
        case 'saveMemory': {
            const entries = loadMemory(req)
            const entry = { key: args.key, content: args.content, tags: args.tags || [], source: 'chat', timestamp: Date.now() / 1000 }
            const idx = entries.findIndex(e => e.key === args.key)
            if (idx >= 0) entries[idx] = entry; else entries.push(entry)
            saveMemory(entries, req)
            return { saved: true, key: args.key }
        }
        case 'searchMemory': {
            const q = (args.query || '').toLowerCase()
            const entries = loadMemory(req)
            const results = entries.filter(e => (e.content || '').toLowerCase().includes(q) || (e.key || '').toLowerCase().includes(q)).slice(0, 5)
            return results.length ? results : { results: 0, message: 'No matching memory entries found.' }
        }
        case 'createGithubIssue': {
            const ghToken = req?.headers?.['x-github-token'] || ENV_GITHUB_TOKEN
            const ghRepo = req?.headers?.['x-github-repo'] || ENV_GITHUB_REPO
            if (!ghToken || !ghRepo) return { error: 'GitHub not configured. Set token and repo in Settings.' }
            try {
                const ghRes = await ghFetch(`/repos/${ghRepo}/issues`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: args.title, body: args.body || '', labels: args.labels || [] }),
                }, { token: ghToken })
                return { created: true, number: ghRes.number, url: ghRes.html_url }
            } catch (err) {
                return { error: err.message }
            }
        }
        case 'commentOnIssue': {
            const ghToken = req?.headers?.['x-github-token'] || ENV_GITHUB_TOKEN
            const ghRepo = req?.headers?.['x-github-repo'] || ENV_GITHUB_REPO
            if (!ghToken || !ghRepo) return { error: 'GitHub not configured.' }
            try {
                await ghFetch(`/repos/${ghRepo}/issues/${args.issue_number}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body: args.body }),
                }, { token: ghToken })
                return { commented: true, issue: args.issue_number }
            } catch (err) {
                return { error: err.message }
            }
        }
        default:
            return { error: `Unknown tool: ${name}` }
    }
}

export { ENV_LLM_BASE_URL, ENV_LLM_API_KEY, ENV_LLM_MODEL }

export default function chatRoutes(app) {
    // POST /kanban/chat — LLM chat with tool calling
    app.post('/kanban/chat', async (req, res) => {
        const llm = getLLMConfig(req)
        if (!llm.apiKey) {
            return res.status(400).json({ error: 'No API key configured. Set it in Settings → AI.' })
        }

        try {
            const { messages } = req.body
            const boardContext = loadAllIssues(req)
            const memory = loadMemory(req)
            const memoryStr = memory.slice(0, 5).map(m => `- [${m.key}] ${(m.content || '').slice(0, 80)}`).join('\n')
            const systemMsg = {
                role: 'system',
                content: `You are a helpful research project assistant managing a kanban board. You have access to tools for managing issues, saving/searching memory, and creating GitHub issues.

Board state (${boardContext.length} issues):
${JSON.stringify(boardContext.map(i => ({ id: i.id, title: i.title, status: i.status, labels: i.labels })), null, 2)}

${memory.length > 0 ? `Shared memory (${memory.length} entries):\n${memoryStr}` : ''}
${ENV_GITHUB_REPO ? `GitHub: ${ENV_GITHUB_REPO}` : ''}

Use tools to take actions. Use markdown formatting in your responses. Be concise and helpful.`,
            }

            let conversation = [systemMsg, ...messages]
            let maxIters = 5

            while (maxIters-- > 0) {
                const llmRes = await fetch(`${llm.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${llm.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: llm.model,
                        messages: conversation,
                        tools: ALL_TOOLS,
                        tool_choice: 'auto',
                    }),
                })

                if (!llmRes.ok) {
                    const errText = await llmRes.text()
                    return res.status(502).json({ error: `LLM API error ${llmRes.status}`, details: errText })
                }

                const data = await llmRes.json()
                const choice = data.choices[0]
                const msg = choice.message

                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    return res.json({ role: 'assistant', content: msg.content })
                }

                conversation.push(msg)
                for (const tc of msg.tool_calls) {
                    const args = JSON.parse(tc.function.arguments)
                    const result = await executeToolCall(tc.function.name, args, req)
                    conversation.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: JSON.stringify(result),
                    })
                }
            }

            return res.json({ role: 'assistant', content: 'I executed several actions. Please check the board for updates.' })
        } catch (err) {
            res.status(500).json({ error: 'Chat failed', details: err.message })
        }
    })

    // GET /kanban/chat/status — check if LLM is configured
    app.get('/kanban/chat/status', (req, res) => {
        const llm = getLLMConfig(req)
        res.json({
            configured: !!llm.apiKey,
            model: llm.model,
            baseUrl: llm.baseUrl.replace(/\/v1$/, ''),
        })
    })

    // POST /kanban/chat/stream — SSE streaming chat with tool calling
    app.post('/kanban/chat/stream', async (req, res) => {
        const llm = getLLMConfig(req)
        if (!llm.apiKey) {
            return res.status(400).json({ error: 'No API key configured.' })
        }

        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')

        try {
            const { messages } = req.body
            const boardContext = loadAllIssues(req)
            const memory = loadMemory(req)
            const memoryStr = memory.slice(0, 5).map(m => `- [${m.key}] ${(m.content || '').slice(0, 80)}`).join('\n')
            const systemMsg = {
                role: 'system',
                content: `You are a helpful research project assistant managing a kanban board. You have access to tools for managing issues, saving/searching memory, and creating GitHub issues.

Board state (${boardContext.length} issues):
${JSON.stringify(boardContext.map(i => ({ id: i.id, title: i.title, status: i.status, labels: i.labels })), null, 2)}

${memory.length > 0 ? `Shared memory (${memory.length} entries):\n${memoryStr}` : ''}
${ENV_GITHUB_REPO ? `GitHub: ${ENV_GITHUB_REPO}` : ''}

Use tools to take actions. Use markdown formatting in your responses. Be concise and helpful.`,
            }

            let conversation = [systemMsg, ...messages]
            let maxIters = 5

            while (maxIters-- > 0) {
                const llmRes = await fetch(`${llm.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${llm.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: llm.model,
                        messages: conversation,
                        tools: ALL_TOOLS,
                        tool_choice: 'auto',
                        stream: true,
                    }),
                })

                if (!llmRes.ok) {
                    const errText = await llmRes.text()
                    res.write(`data: ${JSON.stringify({ error: `LLM API error ${llmRes.status}` })}\n\n`)
                    res.write('data: [DONE]\n\n')
                    return res.end()
                }

                // Read the SSE stream from the LLM
                let fullContent = ''
                let toolCalls = []
                const reader = llmRes.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })

                    const lines = buffer.split('\n')
                    buffer = lines.pop() // keep incomplete line

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        const data = line.slice(6).trim()
                        if (data === '[DONE]') continue

                        try {
                            const chunk = JSON.parse(data)
                            const delta = chunk.choices?.[0]?.delta
                            if (!delta) continue

                            if (delta.content) {
                                fullContent += delta.content
                                res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
                            }

                            // Accumulate tool calls
                            if (delta.tool_calls) {
                                for (const tc of delta.tool_calls) {
                                    if (tc.index !== undefined) {
                                        while (toolCalls.length <= tc.index) toolCalls.push({ id: '', function: { name: '', arguments: '' } })
                                        if (tc.id) toolCalls[tc.index].id = tc.id
                                        if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
                                        if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
                                    }
                                }
                            }
                        } catch { }
                    }
                }

                // If no tool calls, we're done
                if (toolCalls.length === 0) {
                    res.write('data: [DONE]\n\n')
                    return res.end()
                }

                // Execute tool calls and loop
                const assistantMsg = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls }
                conversation.push(assistantMsg)

                for (const tc of toolCalls) {
                    const args = JSON.parse(tc.function.arguments)
                    const result = await executeToolCall(tc.function.name, args, req)
                    conversation.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: JSON.stringify(result),
                    })
                    res.write(`data: ${JSON.stringify({ tool: tc.function.name, args, result })}\n\n`)
                }

                fullContent = ''
                toolCalls = []
            }

            res.write('data: [DONE]\n\n')
            res.end()
        } catch (err) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
            res.write('data: [DONE]\n\n')
            res.end()
        }
    })

    // POST /kanban/workspace/chat — LLM chat scoped to a specific issue workspace
    app.post('/kanban/workspace/chat', async (req, res) => {
        const llm = getLLMConfig(req)
        if (!llm.apiKey) {
            return res.status(400).json({
                error: 'No API key configured. Set it in Settings → AI.',
                fallback: true,
            })
        }

        try {
            const { issueId, workspaceId, messages } = req.body
            if (!issueId || !messages?.length) {
                return res.status(400).json({ error: 'issueId and messages required' })
            }

            // Load issue context
            const issue = loadIssue(issueId, req)
            if (!issue) return res.status(404).json({ error: `Issue #${issueId} not found` })

            const issuesDir = getIssuesDir(req)
            const mdPath = path.join(issuesDir, `${issueId}.md`)
            const description = fs.existsSync(mdPath) ? readMD(mdPath) : '(no description)'

            // Get workspace info
            const ws = workspaceId
                ? (issue.workspaces || []).find(w => w.id === workspaceId)
                : null

            // Board overview for broader context
            const allIssues = loadAllIssues(req)
            const boardOverview = allIssues.map(i => `#${i.id} [${i.status}] ${i.title}`).join('\n')

            const systemMsg = {
                role: 'system',
                content: `You are a research agent working on issue #${issue.id}: "${issue.title}".

Issue details:
- Status: ${issue.status}
- Priority: ${issue.priority}
- Labels: ${(issue.labels || []).join(', ') || 'none'}
- Created: ${issue.createdAt}

Description:
${description.slice(0, 2000)}

${ws ? `Workspace: "${ws.name}" (${ws.status})` : ''}

Board overview (${allIssues.length} issues):
${boardOverview}

You can use tools to create/move issues and query the board. Be concise, specific, and action-oriented. Focus on helping with this issue and its workspace.`,
            }

            let conversation = [systemMsg, ...messages]
            let maxIters = 5

            while (maxIters-- > 0) {
                const llmRes = await fetch(`${llm.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${llm.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: llm.model,
                        messages: conversation,
                        tools: ALL_TOOLS,
                        tool_choice: 'auto',
                    }),
                })

                if (!llmRes.ok) {
                    const errText = await llmRes.text()
                    return res.status(502).json({ error: `LLM API error ${llmRes.status}`, details: errText })
                }

                const data = await llmRes.json()
                const msg = data.choices[0].message

                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    return res.json({ role: 'assistant', content: msg.content })
                }

                conversation.push(msg)
                for (const tc of msg.tool_calls) {
                    const args = JSON.parse(tc.function.arguments)
                    const result = await executeToolCall(tc.function.name, args, req)
                    conversation.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: JSON.stringify(result),
                    })
                }
            }

            return res.json({ role: 'assistant', content: 'I executed several actions. Check the board for updates.' })
        } catch (err) {
            res.status(500).json({ error: 'Workspace chat failed', details: err.message })
        }
    })

    // ── Chat history persistence ──

    // GET /kanban/chat/history — load saved chat messages
    app.get('/kanban/chat/history', (req, res) => {
        res.json(loadChatHistory(req))
    })

    // POST /kanban/chat/history — append a message
    app.post('/kanban/chat/history', (req, res) => {
        const { role, content, toolCalls } = req.body
        if (!role || !content) return res.status(400).json({ error: 'role and content required' })
        const history = loadChatHistory(req)
        const msg = { role, content, timestamp: new Date().toISOString() }
        if (toolCalls) msg.toolCalls = toolCalls
        history.push(msg)
        // Keep last 200 messages to prevent unbounded growth
        if (history.length > 200) history.splice(0, history.length - 200)
        saveChatHistory(history, req)
        res.json({ status: 'ok', total: history.length })
    })

    // DELETE /kanban/chat/history — clear chat history
    app.delete('/kanban/chat/history', (req, res) => {
        saveChatHistory([], req)
        res.json({ status: 'cleared' })
    })
}
