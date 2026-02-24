// ── Tests for orchestration tools: listWorkers, getWorkerOutput ──
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
    createMailbox, registerAgent, updateStatus,
    writeOutbox,
} from '../lib/agent-mailbox.js'
import createListWorkers from '../lib/tools/orchestration/listWorkers.js'
import createGetWorkerOutput from '../lib/tools/orchestration/getWorkerOutput.js'

let mailboxBase

beforeEach(() => {
    mailboxBase = fs.mkdtempSync(path.join(os.tmpdir(), 'test-admin-'))
})

afterEach(() => {
    fs.rmSync(mailboxBase, { recursive: true, force: true })
})

describe('listWorkers', () => {
    it('returns empty when no workers', async () => {
        const tool = createListWorkers({ mailboxBase })
        const result = await tool.execute('tc-1', {})
        assert.match(result.content[0].text, /No workers/)
        assert.deepStrictEqual(result.details.workers, [])
    })

    it('lists workers with status and uptime', async () => {
        createMailbox('w-1', mailboxBase)
        registerAgent('w-1', { task: 'test task', type: 'code', status: 'running' }, mailboxBase)
        updateStatus('w-1', {
            status: 'running', pid: 123, startedAt: Date.now() - 5000,
            toolCalls: 3, turns: 2, lastToolName: 'bash', lastActivity: Date.now() - 1000,
        }, mailboxBase)

        const tool = createListWorkers({ mailboxBase })
        const result = await tool.execute('tc-2', {})
        const w = result.details.workers[0]

        assert.strictEqual(w.agentId, 'w-1')
        assert.strictEqual(w.status, 'running')
        assert.strictEqual(w.toolCalls, 3)
        assert.strictEqual(w.turns, 2)
        assert.strictEqual(w.lastToolName, 'bash')
        assert.match(w.uptime, /\d+s/)
        assert.match(result.content[0].text, /w-1/)
    })

    it('filters by status', async () => {
        createMailbox('w-done', mailboxBase)
        registerAgent('w-done', { task: 'done task', type: 'general' }, mailboxBase)
        updateStatus('w-done', { status: 'complete' }, mailboxBase)

        createMailbox('w-run', mailboxBase)
        registerAgent('w-run', { task: 'running task', type: 'general' }, mailboxBase)
        updateStatus('w-run', { status: 'running' }, mailboxBase)

        const tool = createListWorkers({ mailboxBase })

        const running = await tool.execute('tc-3', { status: 'running' })
        assert.strictEqual(running.details.workers.length, 1)
        assert.strictEqual(running.details.workers[0].agentId, 'w-run')

        const complete = await tool.execute('tc-4', { status: 'complete' })
        assert.strictEqual(complete.details.workers.length, 1)
        assert.strictEqual(complete.details.workers[0].agentId, 'w-done')
    })
})

describe('getWorkerOutput', () => {
    it('returns empty for worker with no output', async () => {
        createMailbox('w-empty', mailboxBase)
        const tool = createGetWorkerOutput({ mailboxBase })
        const result = await tool.execute('tc-5', { agentId: 'w-empty' })
        assert.match(result.content[0].text, /no output/)
    })

    it('reads outbox messages', async () => {
        createMailbox('w-out', mailboxBase)
        writeOutbox('w-out', { type: 'message', content: 'hello master' }, mailboxBase)
        writeOutbox('w-out', { type: 'complete', result: 'task done' }, mailboxBase)

        const tool = createGetWorkerOutput({ mailboxBase })
        const result = await tool.execute('tc-6', { agentId: 'w-out' })

        assert.strictEqual(result.details.count, 2)
        assert.match(result.content[0].text, /hello master/)
        assert.match(result.content[0].text, /task done/)
    })

    it('returns error for non-existent worker', async () => {
        const tool = createGetWorkerOutput({ mailboxBase })
        const result = await tool.execute('tc-7', { agentId: 'nope' })
        assert.match(result.content[0].text, /not found/)
    })

    it('respects limit parameter', async () => {
        createMailbox('w-lim', mailboxBase)
        for (let i = 0; i < 10; i++) {
            writeOutbox('w-lim', { type: 'message', content: `msg ${i}` }, mailboxBase)
        }

        const tool = createGetWorkerOutput({ mailboxBase })
        const result = await tool.execute('tc-8', { agentId: 'w-lim', limit: 3 })
        assert.strictEqual(result.details.count, 3)
    })
})
