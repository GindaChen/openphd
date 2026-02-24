// ── Tests for kanban agent tools ──
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { createKanbanTools } from '../lib/tools/index.js'
import { writeJSON } from '../lib/helpers.js'
import { ensureBootstrapped } from '../lib/project.js'

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-tools-test-'))
}

describe('kanban tools', () => {
    let dataDir, tools, toolMap

    beforeEach(() => {
        dataDir = makeTmpDir()
        ensureBootstrapped(dataDir)
        tools = createKanbanTools({ dataDir })
        toolMap = Object.fromEntries(tools.map(t => [t.name, t]))
    })

    it('boardSummary returns column counts', async () => {
        const result = await toolMap.boardSummary.execute('tc1', {})
        assert.ok(result.content[0].text.includes('0 total issues'))
        assert.ok(result.details.columns.length > 0)
    })

    it('createIssue creates an issue', async () => {
        const result = await toolMap.createIssue.execute('tc2', {
            title: 'Test Issue',
            status: 'backlog',
            priority: 'high',
        })
        assert.ok(result.content[0].text.includes('Created issue #1'))
        assert.equal(result.details.title, 'Test Issue')
        assert.equal(result.details.status, 'backlog')

        // Verify on disk
        const issue = JSON.parse(fs.readFileSync(path.join(dataDir, 'issues', '1.json'), 'utf-8'))
        assert.equal(issue.title, 'Test Issue')
        assert.equal(issue.priority, 'high')
    })

    it('listIssues returns created issues', async () => {
        await toolMap.createIssue.execute('tc3', { title: 'A' })
        await toolMap.createIssue.execute('tc4', { title: 'B', status: 'in-progress' })

        const result = await toolMap.listIssues.execute('tc5', {})
        assert.ok(result.content[0].text.includes('2 issue(s)'))

        // Filter by status
        const filtered = await toolMap.listIssues.execute('tc6', { status: 'in-progress' })
        assert.ok(filtered.content[0].text.includes('1 issue(s)'))
        assert.ok(filtered.content[0].text.includes('B'))
    })

    it('moveIssue changes issue status', async () => {
        await toolMap.createIssue.execute('tc7', { title: 'Moveable' })
        const result = await toolMap.moveIssue.execute('tc8', { id: 1, status: 'done' })
        assert.ok(result.content[0].text.includes('from "backlog" to "done"'))

        // Verify on disk
        const issue = JSON.parse(fs.readFileSync(path.join(dataDir, 'issues', '1.json'), 'utf-8'))
        assert.equal(issue.status, 'done')
    })

    it('moveIssue returns error for missing issue', async () => {
        const result = await toolMap.moveIssue.execute('tc9', { id: 999, status: 'done' })
        assert.ok(result.isError)
        assert.ok(result.content[0].text.includes('not found'))
    })

    it('listIssues returns empty message when no issues', async () => {
        const result = await toolMap.listIssues.execute('tc10', {})
        assert.ok(result.content[0].text.includes('No issues'))
    })

    it('createIssue with description writes markdown', async () => {
        await toolMap.createIssue.execute('tc11', {
            title: 'With Desc',
            description: '# My Issue\n\nSome details here.',
        })
        const md = fs.readFileSync(path.join(dataDir, 'issues', '1.md'), 'utf-8')
        assert.ok(md.includes('Some details here'))
    })

    it('boardSummary shows correct counts after adding issues', async () => {
        await toolMap.createIssue.execute('tc12', { title: 'A', status: 'backlog' })
        await toolMap.createIssue.execute('tc13', { title: 'B', status: 'backlog' })
        await toolMap.createIssue.execute('tc14', { title: 'C', status: 'in-progress' })

        const result = await toolMap.boardSummary.execute('tc15', {})
        assert.ok(result.content[0].text.includes('3 total issues'))
        const backlog = result.details.columns.find(c => c.id === 'backlog')
        assert.equal(backlog.count, 2)
        const inProgress = result.details.columns.find(c => c.id === 'in-progress')
        assert.equal(inProgress.count, 1)
    })
})
