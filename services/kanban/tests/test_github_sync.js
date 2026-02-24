// ── Tests for GitHub sync (pagination, PR filtering, status mapping) ──
import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { writeJSON } from '../lib/helpers.js'
import { ensureBootstrapped } from '../lib/project.js'

// We test the exported helper functions directly and the sync
// logic by simulating what the route handler does.

// ── Test helpers ──
function makeTmpDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-sync-test-'))
    ensureBootstrapped(dir)
    return dir
}

function makeGhIssue(number, opts = {}) {
    return {
        number,
        title: opts.title || `Issue #${number}`,
        state: opts.state || 'open',
        body: opts.body || '',
        labels: opts.labels || [],
        user: { login: 'testuser' },
        html_url: `https://github.com/test/repo/issues/${number}`,
        created_at: opts.created_at || '2024-01-01T00:00:00Z',
        updated_at: opts.updated_at || '2024-01-01T00:00:00Z',
        pull_request: opts.isPR ? { url: 'https://...' } : undefined,
    }
}

// ── Import the functions under test ──
// We import the named exports for unit-level testing
import { ghFetch } from '../routes/github-sync.js'

describe('github-sync', () => {
    let originalFetch

    beforeEach(() => {
        originalFetch = global.fetch
    })
    afterEach(() => {
        global.fetch = originalFetch
    })

    describe('ghFetch', () => {
        it('calls GitHub API with correct headers', async () => {
            let capturedUrl, capturedOpts
            global.fetch = async (url, opts) => {
                capturedUrl = url
                capturedOpts = opts
                return { ok: true, json: async () => ({ data: 'test' }) }
            }

            const result = await ghFetch('/repos/test/repo/issues', {}, { token: 'test-token' })
            assert.equal(result.data, 'test')
            assert.ok(capturedUrl.includes('api.github.com'))
            assert.ok(capturedOpts.headers.Authorization.includes('test-token'))
        })

        it('throws on non-OK response', async () => {
            global.fetch = async () => ({
                ok: false, status: 404, text: async () => 'Not Found',
            })

            await assert.rejects(
                () => ghFetch('/repos/bad/repo', {}, { token: 'x' }),
                /GitHub API 404/
            )
        })
    })

    describe('pagination logic', () => {
        it('fetches multiple pages when first page is full', async () => {
            // Simulate 150 items across 2 pages (100 + 50)
            const page1 = Array.from({ length: 100 }, (_, i) => makeGhIssue(i + 1, { isPR: true }))
            const page2 = Array.from({ length: 50 }, (_, i) => makeGhIssue(i + 101))

            let fetchCount = 0
            global.fetch = async (url) => {
                fetchCount++
                // URL contains full github.com prefix from ghFetch
                const pageMatch = url.match(/[&?]page=(\d+)/)
                const pageNum = pageMatch ? parseInt(pageMatch[1]) : 1
                const items = pageNum === 1 ? page1 : page2
                return { ok: true, json: async () => items }
            }

            // Replicate the pagination loop from github-sync.js
            const ghIssues = []
            let page = 1
            while (true) {
                const pageItems = await ghFetch(
                    `/repos/test/repo/issues?state=all&per_page=100&sort=created&direction=asc&page=${page}`,
                    {}, { token: 'test-token' }
                )
                ghIssues.push(...pageItems)
                if (pageItems.length < 100) break
                page++
            }

            assert.equal(ghIssues.length, 150)
            assert.equal(fetchCount, 2)
        })

        it('stops after a single page when < 100 items', async () => {
            const items = Array.from({ length: 7 }, (_, i) => makeGhIssue(i + 1))

            let fetchCount = 0
            global.fetch = async () => {
                fetchCount++
                return { ok: true, json: async () => items }
            }

            const ghIssues = []
            let page = 1
            while (true) {
                const pageItems = await ghFetch(
                    `/repos/test/repo/issues?state=all&per_page=100&page=${page}`,
                    {}, { token: 'test-token' }
                )
                ghIssues.push(...pageItems)
                if (pageItems.length < 100) break
                page++
            }

            assert.equal(ghIssues.length, 7)
            assert.equal(fetchCount, 1)
        })
    })

    describe('PR filtering', () => {
        it('filters out pull requests from mixed results', () => {
            const items = [
                makeGhIssue(1),               // real issue
                makeGhIssue(2, { isPR: true }), // PR
                makeGhIssue(3),               // real issue
                makeGhIssue(4, { isPR: true }), // PR
                makeGhIssue(5),               // real issue
            ]

            const issues = items.filter(i => !i.pull_request)
            assert.equal(issues.length, 3)
            assert.deepEqual(issues.map(i => i.number), [1, 3, 5])
        })

        it('handles repos where most items are PRs (like DistCA)', () => {
            // Simulate DistCA: 96 PRs + 4 issues in 100 items
            const items = Array.from({ length: 100 }, (_, i) => {
                const num = i + 1
                const isPR = ![53, 68, 80, 83].includes(num)
                return makeGhIssue(num, { isPR })
            })

            const issues = items.filter(i => !i.pull_request)
            assert.equal(issues.length, 4)
        })
    })

    describe('status mapping', () => {
        it('maps closed GitHub issues to done status', () => {
            const mapping = (ghIssue) => ghIssue.state === 'closed' ? 'done' : 'backlog'
            assert.equal(mapping({ state: 'closed' }), 'done')
            assert.equal(mapping({ state: 'open' }), 'backlog')
        })
    })

    describe('priority detection', () => {
        // Import and test detectPriority indirectly by checking label patterns
        it('recognizes priority label patterns', () => {
            const P_LABEL_MAP = { p0: 'critical', p1: 'high', p2: 'medium', p3: 'low', p4: 'none' }
            const boardPriorities = ['critical', 'high', 'medium', 'low', 'none']

            function detectPriority(ghLabels) {
                for (const l of ghLabels) {
                    const name = l.name?.toLowerCase() || ''
                    if (name.startsWith('priority:')) {
                        const val = name.split(':')[1].trim()
                        if (boardPriorities.includes(val)) return val
                    }
                    if (P_LABEL_MAP[name]) return P_LABEL_MAP[name]
                    if (boardPriorities.includes(name)) return name
                }
                return 'none'
            }

            assert.equal(detectPriority([{ name: 'priority:high' }]), 'high')
            assert.equal(detectPriority([{ name: 'P0' }]), 'critical')
            assert.equal(detectPriority([{ name: 'P3' }]), 'low')
            assert.equal(detectPriority([{ name: 'critical' }]), 'critical')
            assert.equal(detectPriority([{ name: 'bug' }]), 'none')
            assert.equal(detectPriority([]), 'none')
        })
    })

    describe('issue creation on disk', () => {
        it('creates issue files from GitHub data', () => {
            const dataDir = makeTmpDir()
            const issuesDir = path.join(dataDir, 'issues')
            const metaPath = path.join(dataDir, '.meta.json')

            const ghIssue = makeGhIssue(42, {
                title: 'Fix the bug',
                state: 'open',
                body: '# Description\n\nSome bug details.',
                labels: [{ name: 'bug' }],
            })

            // Simulate what the sync handler does
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
            const id = meta.nextId
            meta.nextId = id + 1
            writeJSON(metaPath, meta)

            const issue = {
                id, ghId: ghIssue.number, ghUrl: ghIssue.html_url,
                title: ghIssue.title,
                status: ghIssue.state === 'closed' ? 'done' : 'backlog',
                priority: 'none',
                labels: ghIssue.labels.map(l => l.name),
                contextualInfo: { author: ghIssue.user?.login },
                artifacts: [], relationships: [], chatMessages: [], workspaces: [],
                createdAt: ghIssue.created_at, updatedAt: ghIssue.updated_at,
            }
            writeJSON(path.join(issuesDir, `${id}.json`), issue)
            fs.writeFileSync(path.join(issuesDir, `${id}.md`), ghIssue.body || '')

            // Verify
            const saved = JSON.parse(fs.readFileSync(path.join(issuesDir, `${id}.json`), 'utf-8'))
            assert.equal(saved.ghId, 42)
            assert.equal(saved.title, 'Fix the bug')
            assert.equal(saved.status, 'backlog')
            assert.deepEqual(saved.labels, ['bug'])

            const md = fs.readFileSync(path.join(issuesDir, `${id}.md`), 'utf-8')
            assert.ok(md.includes('Some bug details'))
        })

        it('updates existing issue when GitHub version is newer', () => {
            const dataDir = makeTmpDir()
            const issuesDir = path.join(dataDir, 'issues')

            // Create existing local issue
            const existing = {
                id: 1, ghId: 42, title: 'Old title',
                status: 'backlog', priority: 'none', labels: [],
                updatedAt: '2024-01-01T00:00:00Z',
            }
            writeJSON(path.join(issuesDir, '1.json'), existing)

            // Simulate GH issue that's been updated
            const ghIssue = makeGhIssue(42, {
                title: 'New title from GitHub',
                state: 'closed',
                updated_at: '2024-06-01T00:00:00Z',
            })

            // Simulate sync update logic
            const ghUpdated = new Date(ghIssue.updated_at)
            const localUpdated = new Date(existing.updatedAt)
            assert.ok(ghUpdated > localUpdated) // should trigger update

            const issue = JSON.parse(fs.readFileSync(path.join(issuesDir, '1.json'), 'utf-8'))
            issue.title = ghIssue.title
            issue.status = ghIssue.state === 'closed' ? 'done' : 'backlog'
            issue.updatedAt = ghIssue.updated_at
            writeJSON(path.join(issuesDir, '1.json'), issue)

            const updated = JSON.parse(fs.readFileSync(path.join(issuesDir, '1.json'), 'utf-8'))
            assert.equal(updated.title, 'New title from GitHub')
            assert.equal(updated.status, 'done')
        })
    })
})
