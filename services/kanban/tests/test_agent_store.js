/**
 * Tests for agent-id.js and agent-store.js — persistent agent directories
 *
 * Run: node --test services/kanban/tests/test_agent_store.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

import { generateAgentId, parseAgentId } from '../lib/agent-id.js'
import {
    createAgent, loadAgent, listAgents, updateAgentStatus,
    saveHistory, loadHistory, deleteAgent,
} from '../lib/agent-store.js'

// ── Helpers ──

function makeTmpBase() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'agent-store-test-'))
}

// ── Agent ID ──

describe('generateAgentId', () => {
    it('produces YYYY-MM-DD-HH-MM-SS-adj-noun format', () => {
        const id = generateAgentId(new Date('2026-02-24T11:35:21'))
        assert.match(id, /^2026-02-24-11-35-21-[a-z]+-[a-z]+$/)
    })

    it('produces unique IDs on repeated calls', () => {
        const ids = new Set()
        for (let i = 0; i < 20; i++) ids.add(generateAgentId())
        // At least most should be unique (word combos may repeat, but timestamp differs)
        assert.ok(ids.size >= 15, `Expected >= 15 unique IDs, got ${ids.size}`)
    })
})

describe('parseAgentId', () => {
    it('extracts components from valid ID', () => {
        const parsed = parseAgentId('2026-02-24-11-35-21-brave-fox')
        assert.equal(parsed.timestamp, '2026-02-24-11-35-21')
        assert.equal(parsed.adjective, 'brave')
        assert.equal(parsed.noun, 'fox')
        assert.equal(parsed.displayName, 'brave-fox')
    })

    it('returns null for invalid ID', () => {
        assert.equal(parseAgentId('short'), null)
    })
})

// ── Agent Store ──

describe('createAgent', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('creates agent directory with all expected files', () => {
        const { agentId, agentDir } = createAgent({ type: 'master' }, base)
        assert.ok(fs.existsSync(path.join(agentDir, 'config.json')))
        assert.ok(fs.existsSync(path.join(agentDir, 'status.json')))
        assert.ok(fs.existsSync(path.join(agentDir, 'inbox.jsonl')))
        assert.ok(fs.existsSync(path.join(agentDir, 'outbox.jsonl')))
        assert.ok(fs.existsSync(path.join(agentDir, 'history.json')))
    })

    it('config.json contains correct fields', () => {
        const { agentDir } = createAgent({ type: 'workspace', provider: 'google' }, base)
        const config = JSON.parse(fs.readFileSync(path.join(agentDir, 'config.json'), 'utf-8'))
        assert.equal(config.type, 'workspace')
        assert.equal(config.provider, 'google')
        assert.ok(config.displayName)
        assert.ok(config.createdAt)
    })

    it('accepts custom agentId', () => {
        const { agentId } = createAgent({ agentId: '2026-02-24-11-35-21-test-agent' }, base)
        assert.equal(agentId, '2026-02-24-11-35-21-test-agent')
    })
})

describe('loadAgent', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('loads created agent', () => {
        const { agentId } = createAgent({ type: 'worker' }, base)
        const loaded = loadAgent(agentId, base)
        assert.ok(loaded)
        assert.equal(loaded.type, 'worker')
        assert.equal(loaded.status, 'created')
    })

    it('returns null for non-existent agent', () => {
        assert.equal(loadAgent('nonexistent', base), null)
    })
})

describe('listAgents', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('returns all agents sorted by creation', () => {
        createAgent({ type: 'master' }, base)
        createAgent({ type: 'worker' }, base)
        const agents = listAgents(base)
        assert.equal(agents.length, 2)
    })

    it('returns empty array for empty directory', () => {
        const agents = listAgents(base)
        assert.deepEqual(agents, [])
    })

    it('skips memory directory', () => {
        fs.mkdirSync(path.join(base, 'memory', 'shared'), { recursive: true })
        createAgent({ type: 'master' }, base)
        const agents = listAgents(base)
        assert.equal(agents.length, 1)
    })
})

describe('updateAgentStatus', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('merges status updates', () => {
        const { agentId } = createAgent({}, base)
        updateAgentStatus(agentId, { status: 'running', task: 'doing stuff' }, base)
        const loaded = loadAgent(agentId, base)
        assert.equal(loaded.status, 'running')
        assert.equal(loaded.task, 'doing stuff')
    })
})

describe('history', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('saves and loads conversation history', () => {
        const { agentId } = createAgent({}, base)
        const msgs = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
        ]
        saveHistory(agentId, msgs, base)
        const loaded = loadHistory(agentId, base)
        assert.equal(loaded.length, 2)
        assert.equal(loaded[0].content, 'Hello')
    })

    it('returns empty array for no history', () => {
        const { agentId } = createAgent({}, base)
        const loaded = loadHistory(agentId, base)
        assert.deepEqual(loaded, [])
    })
})

describe('deleteAgent', () => {
    let base
    beforeEach(() => { base = makeTmpBase() })
    afterEach(() => { fs.rmSync(base, { recursive: true, force: true }) })

    it('removes agent directory', () => {
        const { agentId, agentDir } = createAgent({}, base)
        assert.ok(fs.existsSync(agentDir))
        const result = deleteAgent(agentId, base)
        assert.ok(result)
        assert.ok(!fs.existsSync(agentDir))
    })

    it('returns false for non-existent agent', () => {
        assert.equal(deleteAgent('nope', base), false)
    })
})
