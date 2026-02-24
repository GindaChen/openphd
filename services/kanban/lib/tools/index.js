// ── Tools Index — barrel export + registry + composers ──
//
// Usage:
//   import { createMasterTools } from './tools/index.js'           // compose a set
//   import { createBash } from './tools/index.js'                   // import one
//   import { TOOL_REGISTRY, discoverTools } from './tools/index.js' // registry

import { loadCursors } from '../agent-mailbox.js'

// ── Individual tool factories ──

// Communication
import createSendToMaster from './communication/sendToMaster.js'
import createSendToWorker from './communication/sendToWorker.js'
import createWaitForReply from './communication/waitForReply.js'
import createWaitForSignals from './communication/waitForSignals.js'
import createReportComplete from './communication/reportComplete.js'

// Orchestration
import createSpawnWorker from './orchestration/spawnWorker.js'
import createListWorkers from './orchestration/listWorkers.js'
import createGetWorkerOutput from './orchestration/getWorkerOutput.js'

// Coding
import createReadFile from './coding/readFile.js'
import createWriteFile from './coding/writeFile.js'
import createBash from './coding/bash.js'
import createListFiles from './coding/listFiles.js'

// Kanban
import createCreateIssue from './kanban/createIssue.js'
import createMoveIssue from './kanban/moveIssue.js'
import createListIssues from './kanban/listIssues.js'
import createBoardSummary from './kanban/boardSummary.js'

export {
    // Communication
    createSendToMaster, createSendToWorker, createWaitForReply,
    createWaitForSignals, createReportComplete,
    // Orchestration
    createSpawnWorker, createListWorkers, createGetWorkerOutput,
    // Coding
    createReadFile, createWriteFile, createBash, createListFiles,
    // Kanban
    createCreateIssue, createMoveIssue, createListIssues, createBoardSummary,
}

// ── Tool Registry ──
// Categorized catalog of all tools. A skill can query this to discover tools.

export const TOOL_REGISTRY = {
    communication: {
        description: 'Inter-agent messaging — send/receive messages between master and workers',
        tools: {
            sendToMaster: { factory: createSendToMaster, description: 'Worker → Master message', requiredCtx: ['agentId', 'mailboxBase'] },
            sendToWorker: { factory: createSendToWorker, description: 'Master → Worker message', requiredCtx: ['mailboxBase'] },
            waitForReply: { factory: createWaitForReply, description: 'Worker blocks until master replies', requiredCtx: ['agentId', 'mailboxBase'] },
            waitForSignals: { factory: createWaitForSignals, description: 'Master blocks until worker signal', requiredCtx: ['mailboxBase', 'cursors'] },
            reportComplete: { factory: createReportComplete, description: 'Worker signals task completion', requiredCtx: ['agentId', 'mailboxBase'] },
        },
    },
    orchestration: {
        description: 'Agent lifecycle — spawn and monitor worker agents',
        tools: {
            spawnWorker: { factory: createSpawnWorker, description: 'Spawn a worker as child process', requiredCtx: ['mailboxBase'] },
            listWorkers: { factory: createListWorkers, description: 'List all workers with status/uptime', requiredCtx: ['mailboxBase'] },
            getWorkerOutput: { factory: createGetWorkerOutput, description: 'Read a worker\'s outbox messages', requiredCtx: ['mailboxBase'] },
        },
    },
    coding: {
        description: 'File I/O and shell execution for code tasks',
        tools: {
            readFile: { factory: createReadFile, description: 'Read file contents', requiredCtx: [] },
            writeFile: { factory: createWriteFile, description: 'Write file contents', requiredCtx: [] },
            bash: { factory: createBash, description: 'Execute bash command', requiredCtx: [] },
            listFiles: { factory: createListFiles, description: 'List files', requiredCtx: [] },
        },
    },
    kanban: {
        description: 'Kanban board CRUD — create/move/list issues and get board overview',
        tools: {
            createIssue: { factory: createCreateIssue, description: 'Create a new kanban issue', requiredCtx: ['dataDir'] },
            moveIssue: { factory: createMoveIssue, description: 'Move issue to different column', requiredCtx: ['dataDir'] },
            listIssues: { factory: createListIssues, description: 'List issues with optional filter', requiredCtx: ['dataDir'] },
            boardSummary: { factory: createBoardSummary, description: 'Board overview with counts', requiredCtx: ['dataDir'] },
        },
    },
}

/**
 * Human-readable summary of available tools (for agent skill discovery).
 */
export function discoverTools(categories) {
    const cats = categories
        ? Object.entries(TOOL_REGISTRY).filter(([k]) => categories.includes(k))
        : Object.entries(TOOL_REGISTRY)

    return cats.map(([cat, { description, tools }]) => {
        const list = Object.entries(tools).map(([n, t]) => `  - ${n}: ${t.description}`).join('\n')
        return `[${cat}] ${description}\n${list}`
    }).join('\n\n')
}

/**
 * Instantiate tools by name from the registry with shared context.
 */
export function instantiateTools(toolNames, ctx) {
    const tools = []
    for (const name of toolNames) {
        for (const [, { tools: catTools }] of Object.entries(TOOL_REGISTRY)) {
            if (catTools[name]) { tools.push(catTools[name].factory(ctx)); break }
        }
    }
    return tools
}

// ── Composers ──

export function createMasterTools(ctx = {}) {
    const cursors = loadCursors(ctx.mailboxBase)
    const sharedCtx = { ...ctx, cursors, onWorkerSpawned: (id) => { cursors[id] = 0 } }
    return [
        createSpawnWorker(sharedCtx), createSendToWorker(sharedCtx),
        createListWorkers(sharedCtx), createGetWorkerOutput(sharedCtx),
        createWaitForSignals(sharedCtx),
        // Kanban tools — master agent can manage the board directly
        ...(ctx.dataDir ? createKanbanTools(ctx) : []),
    ]
}

export function createWorkerTools(ctx = {}) {
    return [createSendToMaster(ctx), createWaitForReply(ctx), createReportComplete(ctx)]
}

export function createCodingTools(ctx = {}) {
    return [createReadFile(ctx), createWriteFile(ctx), createBash(ctx), createListFiles(ctx)]
}

export function createKanbanTools(ctx = {}) {
    return [createCreateIssue(ctx), createMoveIssue(ctx), createListIssues(ctx), createBoardSummary(ctx)]
}
