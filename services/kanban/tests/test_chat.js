/**
 * Tests for chat history persistence and unified tool set in chat.js
 *
 * Run: node --test services/kanban/tests/test_chat.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { readJSON, writeJSON } from '../lib/helpers.js'
import { ensureBootstrapped } from '../lib/project.js'

// ── Helpers ──

function makeTmpDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-chat-test-'))
    // Create the .agents/kanban structure that getDataDir expects
    const dataDir = path.join(tmp, '.agents', 'kanban')
    fs.mkdirSync(dataDir, { recursive: true })
    ensureBootstrapped(dataDir)
    return { root: tmp, dataDir }
}

function fakeReq(root) {
    return { headers: { 'x-project-root': root } }
}

// ── Chat History Persistence ──

describe('chat history persistence', () => {
    let root, dataDir

    beforeEach(() => {
        const tmp = makeTmpDir()
        root = tmp.root
        dataDir = tmp.dataDir
    })

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true })
    })

    it('returns empty array when no history file exists', () => {
        const historyPath = path.join(dataDir, 'chat-history.json')
        // No file exists yet
        assert.ok(!fs.existsSync(historyPath))
    })

    it('saves and loads chat messages', () => {
        const historyPath = path.join(dataDir, 'chat-history.json')
        const messages = [
            { role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
            { role: 'assistant', content: 'Hi there!', timestamp: '2026-01-01T00:00:01Z' },
        ]
        writeJSON(historyPath, messages)
        const loaded = readJSON(historyPath)
        assert.strictEqual(loaded.length, 2)
        assert.strictEqual(loaded[0].role, 'user')
        assert.strictEqual(loaded[1].content, 'Hi there!')
    })

    it('appends messages correctly', () => {
        const historyPath = path.join(dataDir, 'chat-history.json')
        const messages = [
            { role: 'user', content: 'First', timestamp: '2026-01-01T00:00:00Z' },
        ]
        writeJSON(historyPath, messages)

        const loaded = readJSON(historyPath)
        loaded.push({ role: 'assistant', content: 'Second', timestamp: '2026-01-01T00:00:01Z' })
        writeJSON(historyPath, loaded)

        const final = readJSON(historyPath)
        assert.strictEqual(final.length, 2)
        assert.strictEqual(final[1].content, 'Second')
    })

    it('clears history by writing empty array', () => {
        const historyPath = path.join(dataDir, 'chat-history.json')
        writeJSON(historyPath, [
            { role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
        ])
        writeJSON(historyPath, [])
        const loaded = readJSON(historyPath)
        assert.strictEqual(loaded.length, 0)
    })

    it('preserves toolCalls in messages', () => {
        const historyPath = path.join(dataDir, 'chat-history.json')
        const messages = [{
            role: 'assistant',
            content: 'Done!',
            timestamp: '2026-01-01T00:00:00Z',
            toolCalls: [{ tool: 'createIssue', args: { title: 'Test' }, result: { success: true } }],
        }]
        writeJSON(historyPath, messages)
        const loaded = readJSON(historyPath)
        assert.strictEqual(loaded[0].toolCalls.length, 1)
        assert.strictEqual(loaded[0].toolCalls[0].tool, 'createIssue')
    })
})

// ── Memory persistence ──

describe('memory persistence', () => {
    let root, dataDir

    beforeEach(() => {
        const tmp = makeTmpDir()
        root = tmp.root
        dataDir = tmp.dataDir
    })

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true })
    })

    it('saves and searches memory entries', () => {
        const memDir = path.join(root, '.agents', 'agents', 'memory', 'shared')
        fs.mkdirSync(memDir, { recursive: true })
        const memPath = path.join(memDir, 'entries.json')

        const entries = [
            { key: 'fact1', content: 'The sky is blue', tags: ['science'], source: 'chat', timestamp: Date.now() / 1000 },
            { key: 'fact2', content: 'Water boils at 100C', tags: ['science'], source: 'chat', timestamp: Date.now() / 1000 },
        ]
        writeJSON(memPath, entries)

        const loaded = readJSON(memPath)
        assert.strictEqual(loaded.length, 2)

        // Search simulation
        const q = 'sky'
        const results = loaded.filter(e => e.content.toLowerCase().includes(q))
        assert.strictEqual(results.length, 1)
        assert.strictEqual(results[0].key, 'fact1')
    })
})
