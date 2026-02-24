/**
 * Tests for agent-mailbox.js — file-based inter-agent communication
 *
 * Run: node --test services/kanban/tests/test_agent_mailbox.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

import {
    createMailbox, sendMessage, writeOutbox,
    readInbox, readOutbox, updateStatus, getStatus,
    loadRegistry, saveRegistry, registerAgent, unregisterAgent,
    pollSignals, getMailboxDir,
} from '../lib/agent-mailbox.js'

// ── Helpers ──

function makeTmpMailbox() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'mailbox-test-'))
}

// ── Mailbox creation ──

describe('createMailbox', () => {
    let base
    beforeEach(() => { base = makeTmpMailbox() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('creates mailbox directory with inbox, outbox, and status', () => {
        const result = createMailbox('agent-1', base)
        assert.ok(fs.existsSync(result.inbox))
        assert.ok(fs.existsSync(result.outbox))
        assert.ok(fs.existsSync(result.status))

        const status = JSON.parse(fs.readFileSync(result.status, 'utf-8'))
        assert.equal(status.agentId, 'agent-1')
        assert.equal(status.status, 'starting')
    })

    it('is idempotent', () => {
        createMailbox('agent-1', base)
        createMailbox('agent-1', base)
        assert.ok(fs.existsSync(getMailboxDir('agent-1', base)))
    })
})

// ── Message I/O ──

describe('message I/O', () => {
    let base
    beforeEach(() => {
        base = makeTmpMailbox()
        createMailbox('agent-1', base)
    })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('sendMessage writes to inbox.jsonl', () => {
        sendMessage('agent-1', 'hello', base)
        sendMessage('agent-1', 'world', base)

        const { messages, totalLines } = readInbox('agent-1', 0, base)
        assert.equal(messages.length, 2)
        assert.equal(totalLines, 2)
        assert.equal(messages[0].content, 'hello')
        assert.equal(messages[1].content, 'world')
    })

    it('writeOutbox writes to outbox.jsonl', () => {
        writeOutbox('agent-1', 'status update', base)

        const { messages, totalLines } = readOutbox('agent-1', 0, base)
        assert.equal(messages.length, 1)
        assert.equal(messages[0].content, 'status update')
        assert.equal(messages[0].from, 'agent-1')
    })

    it('readInbox with cursor returns only new messages', () => {
        sendMessage('agent-1', 'msg1', base)
        sendMessage('agent-1', 'msg2', base)
        sendMessage('agent-1', 'msg3', base)

        const { messages: all } = readInbox('agent-1', 0, base)
        assert.equal(all.length, 3)

        const { messages: newOnly } = readInbox('agent-1', 2, base)
        assert.equal(newOnly.length, 1)
        assert.equal(newOnly[0].content, 'msg3')
    })

    it('readInbox returns empty for non-existent agent', () => {
        const { messages } = readInbox('nonexistent', 0, base)
        assert.equal(messages.length, 0)
    })
})

// ── Status management ──

describe('status management', () => {
    let base
    beforeEach(() => {
        base = makeTmpMailbox()
        createMailbox('agent-1', base)
    })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('updateStatus merges with existing status', () => {
        updateStatus('agent-1', { status: 'running', pid: 1234 }, base)
        const s1 = getStatus('agent-1', base)
        assert.equal(s1.status, 'running')
        assert.equal(s1.pid, 1234)
        assert.equal(s1.agentId, 'agent-1') // preserved from create

        updateStatus('agent-1', { status: 'complete', result: 'done' }, base)
        const s2 = getStatus('agent-1', base)
        assert.equal(s2.status, 'complete')
        assert.equal(s2.pid, 1234) // still there
        assert.equal(s2.result, 'done')
    })

    it('getStatus returns null for non-existent agent', () => {
        assert.equal(getStatus('nonexistent', base), null)
    })
})

// ── Registry ──

describe('registry', () => {
    let base
    beforeEach(() => { base = makeTmpMailbox() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('register and load agents', () => {
        registerAgent('a1', { task: 'task1', type: 'general' }, base)
        registerAgent('a2', { task: 'task2', type: 'code' }, base)

        const reg = loadRegistry(base)
        assert.equal(Object.keys(reg.agents).length, 2)
        assert.equal(reg.agents.a1.task, 'task1')
        assert.equal(reg.agents.a2.type, 'code')
    })

    it('unregister removes agent', () => {
        registerAgent('a1', { task: 'task1' }, base)
        unregisterAgent('a1', base)

        const reg = loadRegistry(base)
        assert.equal(Object.keys(reg.agents).length, 0)
    })

    it('loadRegistry returns empty for no file', () => {
        const reg = loadRegistry(base)
        assert.deepEqual(reg, { agents: {} })
    })
})

// ── Signal polling ──

describe('pollSignals', () => {
    let base
    beforeEach(() => {
        base = makeTmpMailbox()
        createMailbox('worker-1', base)
        registerAgent('worker-1', { task: 'test', type: 'general' }, base)
        updateStatus('worker-1', { status: 'running' }, base)
    })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('detects agent exit signal', () => {
        updateStatus('worker-1', { status: 'complete', result: 'done', exitCode: 0 }, base)

        const signals = pollSignals({}, base)
        const exitSignal = signals.find(s => s.type === 'agent_exit')
        assert.ok(exitSignal)
        assert.equal(exitSignal.agentId, 'worker-1')
        assert.equal(exitSignal.status, 'complete')
    })

    it('detects agent message signal', () => {
        writeOutbox('worker-1', 'progress: 50%', base)

        const signals = pollSignals({}, base)
        const msgSignal = signals.find(s => s.type === 'agent_message')
        assert.ok(msgSignal)
        assert.equal(msgSignal.agentId, 'worker-1')
        assert.equal(msgSignal.messages.length, 1)
        assert.equal(msgSignal.messages[0].content, 'progress: 50%')
    })

    it('respects outbox cursor (no duplicate messages)', () => {
        writeOutbox('worker-1', 'msg1', base)
        writeOutbox('worker-1', 'msg2', base)

        // First poll — sees both
        const s1 = pollSignals({}, base)
        const msg1 = s1.find(s => s.type === 'agent_message')
        assert.equal(msg1.messages.length, 2)

        // Second poll with updated cursor — sees nothing new
        const s2 = pollSignals({ 'worker-1': msg1.newCursor }, base)
        const msg2 = s2.find(s => s.type === 'agent_message')
        assert.equal(msg2, undefined)

        // Write new message — detected
        writeOutbox('worker-1', 'msg3', base)
        const s3 = pollSignals({ 'worker-1': msg1.newCursor }, base)
        const msg3 = s3.find(s => s.type === 'agent_message')
        assert.ok(msg3)
        assert.equal(msg3.messages.length, 1)
        assert.equal(msg3.messages[0].content, 'msg3')
    })

    it('returns empty when no signals', () => {
        const signals = pollSignals({}, base)
        assert.equal(signals.length, 0)
    })
})
