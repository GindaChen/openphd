/**
 * Tests for kanban lib/project.js — data directory resolution, bootstrapping, and issue CRUD helpers.
 *
 * Uses Node.js built-in test runner (no extra dev dependencies).
 * Run: node --test services/kanban/tests/test_project.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'

import {
    getDataDir, getIssuesDir, ensureBootstrapped,
    loadIssue, loadAllIssues, getNextId, DEFAULT_DATA_DIR,
} from '../lib/project.js'
import { readJSON, writeJSON, readMD, writeMD } from '../lib/helpers.js'

// ── Test helpers ──

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-test-'))
}

function fakeReq(dataDir) {
    return { headers: { 'x-project-root': dataDir } }
}

// ── helpers.js ──

describe('helpers', () => {
    let tmpDir

    beforeEach(() => { tmpDir = makeTmpDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }) })

    it('readJSON / writeJSON roundtrip', () => {
        const fpath = path.join(tmpDir, 'test.json')
        const data = { hello: 'world', n: 42 }
        writeJSON(fpath, data)
        assert.deepStrictEqual(readJSON(fpath), data)
    })

    it('readMD / writeMD roundtrip', () => {
        const fpath = path.join(tmpDir, 'test.md')
        writeMD(fpath, '# Hello\nWorld')
        assert.strictEqual(readMD(fpath), '# Hello\nWorld')
    })

    it('readMD returns empty string for missing file', () => {
        assert.strictEqual(readMD(path.join(tmpDir, 'nope.md')), '')
    })
})

// ── project.js ──

describe('getDataDir', () => {
    it('returns header value when present and absolute', () => {
        assert.strictEqual(getDataDir({ headers: { 'x-project-root': '/tmp/foo' } }), '/tmp/foo/.agents/kanban')
    })

    it('returns DEFAULT_DATA_DIR when header is missing', () => {
        assert.strictEqual(getDataDir({ headers: {} }), DEFAULT_DATA_DIR)
    })

    it('returns DEFAULT_DATA_DIR when header is relative', () => {
        assert.strictEqual(getDataDir({ headers: { 'x-project-root': 'relative/path' } }), DEFAULT_DATA_DIR)
    })
})

describe('ensureBootstrapped', () => {
    let tmpDir

    beforeEach(() => { tmpDir = makeTmpDir() })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }) })

    it('creates issues directory', () => {
        const dataDir = path.join(tmpDir, 'data')
        fs.mkdirSync(dataDir)
        ensureBootstrapped(dataDir)
        assert.ok(fs.existsSync(path.join(dataDir, 'issues')))
    })

    it('creates .meta.json with nextId: 1', () => {
        const dataDir = path.join(tmpDir, 'data')
        fs.mkdirSync(dataDir)
        ensureBootstrapped(dataDir)
        const meta = readJSON(path.join(dataDir, '.meta.json'))
        assert.strictEqual(meta.nextId, 1)
    })

    it('creates board.json with default columns', () => {
        const dataDir = path.join(tmpDir, 'data')
        fs.mkdirSync(dataDir)
        ensureBootstrapped(dataDir)
        const board = readJSON(path.join(dataDir, 'board.json'))
        assert.ok(board.columns.length > 0)
        assert.ok(board.columns.some(c => c.id === 'backlog'))
    })

    it('is idempotent', () => {
        const dataDir = path.join(tmpDir, 'data')
        fs.mkdirSync(dataDir)
        ensureBootstrapped(dataDir)
        ensureBootstrapped(dataDir) // second call should not throw
        assert.ok(fs.existsSync(path.join(dataDir, 'issues')))
    })
})

describe('issue CRUD helpers', () => {
    let tmpDir, req

    beforeEach(() => {
        tmpDir = makeTmpDir()
        req = fakeReq(tmpDir)
        ensureBootstrapped(getDataDir(req))
    })
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }) })

    it('getNextId increments', () => {
        const id1 = getNextId(req)
        const id2 = getNextId(req)
        assert.strictEqual(id1, 1)
        assert.strictEqual(id2, 2)
    })

    it('loadIssue returns null for missing issue', () => {
        assert.strictEqual(loadIssue(999, req), null)
    })

    it('loadIssue returns issue with description', () => {
        const issuesDir = getIssuesDir(req)
        const issue = { id: 1, title: 'Test', status: 'backlog' }
        writeJSON(path.join(issuesDir, '1.json'), issue)
        writeMD(path.join(issuesDir, '1.md'), '# Test\nDescription here')

        const loaded = loadIssue(1, req)
        assert.strictEqual(loaded.title, 'Test')
        assert.strictEqual(loaded.description, '# Test\nDescription here')
    })

    it('loadAllIssues returns sorted array', () => {
        const issuesDir = getIssuesDir(req)
        writeJSON(path.join(issuesDir, '2.json'), { id: 2, title: 'Second' })
        writeJSON(path.join(issuesDir, '1.json'), { id: 1, title: 'First' })
        writeMD(path.join(issuesDir, '1.md'), '')
        writeMD(path.join(issuesDir, '2.md'), '')

        const all = loadAllIssues(req)
        assert.strictEqual(all.length, 2)
        assert.strictEqual(all[0].id, 1)
        assert.strictEqual(all[1].id, 2)
    })

    it('loadAllIssues returns empty array for no issues', () => {
        const all = loadAllIssues(req)
        assert.strictEqual(all.length, 0)
    })
})
