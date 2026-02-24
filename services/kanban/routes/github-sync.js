// ── GitHub Sync routes ──
import path from 'path'
import { readJSON, writeJSON, readMD, writeMD } from '../lib/helpers.js'
import { getDataDir, getIssuesDir, ensureBootstrapped, loadAllIssues, getNextId } from '../lib/project.js'

// Env vars as defaults, but allow frontend to pass via headers
const ENV_GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const ENV_GITHUB_REPO = process.env.GITHUB_REPO || ''

function getGHConfig(req) {
    return {
        token: req.headers['x-github-token'] || ENV_GITHUB_TOKEN,
        repo: req.headers['x-github-repo'] || ENV_GITHUB_REPO,
    }
}

export async function ghFetch(endpoint, opts = {}, config = {}) {
    const token = config.token || ENV_GITHUB_TOKEN
    const res = await fetch(`https://api.github.com${endpoint}`, {
        ...opts,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(opts.headers || {}),
        },
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`)
    }
    return res.json()
}

// ── Priority detection from GitHub labels (dynamic, not hardcoded) ──
// Reads the board's configured priorities and matches GitHub labels against them.
// Supports patterns: "priority:high", "P0", "P1", "P2", "P3", or bare priority names.
const P_LABEL_MAP = { p0: 'critical', p1: 'high', p2: 'medium', p3: 'low', p4: 'none' }

function detectPriority(ghLabels, boardPriorities = []) {
    for (const l of ghLabels) {
        const name = l.name?.toLowerCase() || ''

        // Check "priority:<value>" pattern
        if (name.startsWith('priority:')) {
            const val = name.split(':')[1].trim()
            if (boardPriorities.includes(val)) return val
        }

        // Check P0–P4 shorthand
        if (P_LABEL_MAP[name]) return P_LABEL_MAP[name]

        // Check bare priority name (e.g., label named "critical" or "high")
        if (boardPriorities.includes(name)) return name
    }
    return 'none'
}

// Labels that represent priority (should be excluded from the generic labels array)
function isPriorityLabel(name, boardPriorities = []) {
    const lower = name.toLowerCase()
    if (lower.startsWith('priority:')) return true
    if (P_LABEL_MAP[lower]) return true
    if (boardPriorities.includes(lower)) return true
    return false
}

// ── Status mapping — derive from GitHub issue state only ──
function ghStateToStatus(ghIssue) {
    if (ghIssue.state === 'closed') return 'done'
    return 'backlog'
}

// ── Label color sync ──
// Convert GitHub hex color to a dark-theme-friendly bg/text pair
function hexToLabelColors(hex) {
    // GitHub gives hex without #, e.g. "d73a4a"
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    // Dark bg: dim version of the color
    const bg = `rgba(${r}, ${g}, ${b}, 0.18)`
    // Text: bright version
    const text = `#${hex}`
    return { bg, text }
}

export { ENV_GITHUB_TOKEN, ENV_GITHUB_REPO }

export default function githubSyncRoutes(app) {
    // GET /kanban/sync/status — check if GitHub sync is configured
    app.get('/kanban/sync/status', (req, res) => {
        const gh = getGHConfig(req)
        res.json({
            configured: !!(gh.token && gh.repo),
            repo: gh.repo || null,
        })
    })

    // POST /kanban/sync/pull — pull GitHub issues → local
    app.post('/kanban/sync/pull', async (req, res) => {
        const gh = getGHConfig(req)
        if (!gh.token || !gh.repo) {
            return res.status(400).json({ error: 'GitHub not configured. Set token and repo in Settings.' })
        }

        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const board = readJSON(path.join(dataDir, 'board.json'))
            const boardPriorities = board.priorities || []

            // 1. Sync repo labels → board.json label colors
            let labelsSynced = 0
            try {
                const repoLabels = await ghFetch(`/repos/${gh.repo}/labels?per_page=100`, {}, gh)
                const updatedLabels = { ...(board.labels || {}) }
                for (const label of repoLabels) {
                    if (label.color) {
                        updatedLabels[label.name] = hexToLabelColors(label.color)
                        labelsSynced++
                    }
                }
                board.labels = updatedLabels
                writeJSON(path.join(dataDir, 'board.json'), board)
            } catch (err) {
                console.warn('Failed to sync repo labels:', err.message)
            }

            // 2. Fetch ALL issues with pagination (GitHub mixes PRs in, so we
            //    may need multiple pages to get all actual issues)
            const filterLabel = req.body.label || ''
            const labelParam = filterLabel ? `&labels=${encodeURIComponent(filterLabel)}` : ''
            const ghIssues = []
            let page = 1
            while (true) {
                const pageItems = await ghFetch(
                    `/repos/${gh.repo}/issues?state=all&per_page=100&sort=created&direction=asc&page=${page}${labelParam}`,
                    {}, gh
                )
                ghIssues.push(...pageItems)
                if (pageItems.length < 100) break // last page
                page++
            }

            let created = 0, updated = 0, skipped = 0

            for (const ghIssue of ghIssues) {
                // Skip pull requests (GitHub API returns them mixed with issues)
                if (ghIssue.pull_request) { skipped++; continue }

                const allLabels = (ghIssue.labels || []).map(l => l.name)
                const priority = detectPriority(ghIssue.labels || [], boardPriorities)
                const issueLabels = allLabels.filter(name => !isPriorityLabel(name, boardPriorities))
                const status = ghStateToStatus(ghIssue)

                const existing = loadAllIssues(req).find(i => i.ghId === ghIssue.number)
                if (existing) {
                    const ghUpdated = new Date(ghIssue.updated_at)
                    const localUpdated = new Date(existing.updatedAt)
                    if (ghUpdated > localUpdated) {
                        const issuesDir = getIssuesDir(req)
                        const jsonPath = path.join(issuesDir, `${existing.id}.json`)
                        const issue = readJSON(jsonPath)
                        issue.title = ghIssue.title
                        issue.status = status
                        issue.priority = priority
                        issue.labels = issueLabels
                        issue.updatedAt = ghIssue.updated_at
                        writeJSON(jsonPath, issue)
                        writeMD(path.join(issuesDir, `${existing.id}.md`), ghIssue.body || '')
                        updated++
                    } else {
                        skipped++
                    }
                } else {
                    const issuesDir = getIssuesDir(req)
                    const id = getNextId(req)
                    const issue = {
                        id, ghId: ghIssue.number, ghUrl: ghIssue.html_url,
                        title: ghIssue.title,
                        status,
                        priority,
                        labels: issueLabels,
                        contextualInfo: { author: ghIssue.user?.login },
                        artifacts: [], relationships: [], chatMessages: [], workspaces: [],
                        createdAt: ghIssue.created_at, updatedAt: ghIssue.updated_at,
                    }
                    writeJSON(path.join(issuesDir, `${id}.json`), issue)
                    writeMD(path.join(issuesDir, `${id}.md`), ghIssue.body || '')
                    created++
                }
            }

            res.json({ created, updated, skipped, total: ghIssues.length, labelsSynced })
        } catch (err) {
            res.status(500).json({ error: 'Sync pull failed', details: err.message })
        }
    })

    // POST /kanban/sync/push — push local issues → GitHub
    app.post('/kanban/sync/push', async (req, res) => {
        const gh = getGHConfig(req)
        if (!gh.token || !gh.repo) {
            return res.status(400).json({ error: 'GitHub not configured. Set token and repo in Settings.' })
        }

        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const board = readJSON(path.join(dataDir, 'board.json'))
            const boardPriorities = board.priorities || []

            const issuesDir = getIssuesDir(req)
            const issues = loadAllIssues(req)
            let pushed = 0, skipped = 0

            for (const issue of issues) {
                // Build labels: all local labels + priority label (if not 'none')
                const ghLabels = [...(issue.labels || [])]
                if (issue.priority && issue.priority !== 'none' && boardPriorities.includes(issue.priority)) {
                    ghLabels.push(`priority:${issue.priority}`)
                }

                const body = {
                    title: issue.title,
                    body: readMD(path.join(issuesDir, `${issue.id}.md`)),
                    labels: ghLabels,
                    state: issue.status === 'done' ? 'closed' : 'open',
                }

                if (issue.ghId) {
                    try {
                        await ghFetch(`/repos/${gh.repo}/issues/${issue.ghId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        }, gh)
                        pushed++
                    } catch { skipped++ }
                } else {
                    try {
                        const created = await ghFetch(`/repos/${gh.repo}/issues`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        }, gh)
                        const jsonPath = path.join(issuesDir, `${issue.id}.json`)
                        const meta = readJSON(jsonPath)
                        meta.ghId = created.number
                        meta.ghUrl = created.html_url
                        writeJSON(jsonPath, meta)
                        pushed++
                    } catch { skipped++ }
                }
            }

            res.json({ pushed, skipped, total: issues.length })
        } catch (err) {
            res.status(500).json({ error: 'Sync push failed', details: err.message })
        }
    })

    // POST /kanban/sync/setup-labels — create default labels on the GitHub repo
    app.post('/kanban/sync/setup-labels', async (req, res) => {
        const gh = getGHConfig(req)
        if (!gh.token || !gh.repo) {
            return res.status(400).json({ error: 'GitHub not configured. Set token and repo in Settings.' })
        }

        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const board = readJSON(path.join(dataDir, 'board.json'))

            // Default label definitions: priority labels + board labels
            const PRIORITY_COLORS = {
                critical: 'e11d48',
                high: 'f59e0b',
                medium: '6b7280',
                low: '3b82f6',
            }

            const labelsToCreate = []

            // Priority labels from board config
            for (const p of (board.priorities || [])) {
                if (p === 'none') continue
                labelsToCreate.push({
                    name: `priority:${p}`,
                    color: PRIORITY_COLORS[p] || '6b7280',
                    description: `Priority: ${p}`,
                })
            }

            let created = 0, existing = 0, failed = 0
            const results = []

            for (const label of labelsToCreate) {
                try {
                    await ghFetch(`/repos/${gh.repo}/labels`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(label),
                    }, gh)
                    created++
                    results.push({ name: label.name, status: 'created' })
                } catch (err) {
                    if (err.message.includes('422')) {
                        // Label already exists — try to update its color
                        try {
                            await ghFetch(`/repos/${gh.repo}/labels/${encodeURIComponent(label.name)}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ color: label.color, description: label.description }),
                            }, gh)
                            existing++
                            results.push({ name: label.name, status: 'updated' })
                        } catch {
                            existing++
                            results.push({ name: label.name, status: 'exists' })
                        }
                    } else {
                        failed++
                        results.push({ name: label.name, status: 'failed', error: err.message })
                    }
                }
            }

            res.json({ created, existing, failed, total: labelsToCreate.length, results })
        } catch (err) {
            res.status(500).json({ error: 'Label setup failed', details: err.message })
        }
    })
}
