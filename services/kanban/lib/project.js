// ── Per-request project / data directory resolution ──
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { readJSON, writeJSON, readMD } from './helpers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const DEFAULT_DATA_DIR = process.env.KANBAN_DATA_DIR || path.join(__dirname, '..', '..', '..', 'data', 'kanban')

// ── Default board config for bootstrapping new directories ──
const DEFAULT_BOARD = {
    name: 'Research Board',
    columns: [
        { id: 'backlog', label: 'Backlog', emoji: '📋', description: 'Not yet started' },
        { id: 'ideation', label: 'Ideation', emoji: '💡', description: 'Still a drafting idea' },
        { id: 'in-progress', label: 'In Progress', emoji: '🔨', description: 'Actively being worked on' },
        { id: 'blocked', label: 'Blocked', emoji: '🚫', description: 'Needs help from human' },
        { id: 'review', label: 'Review', emoji: '👀', description: 'This item is in review' },
        { id: 'done', label: 'Done', emoji: '✅', description: 'This has been completed' },
    ],
    labels: {},
    priorities: ['critical', 'high', 'medium', 'low', 'none'],
}

// ── Per-request data directory resolution ──

export function getDataDir(req) {
    const headerRoot = req?.headers?.['x-project-root']
    if (headerRoot && path.isAbsolute(headerRoot)) {
        return path.join(headerRoot, '.agents', 'kanban')
    }
    return DEFAULT_DATA_DIR
}

export function getIssuesDir(req) {
    return path.join(getDataDir(req), 'issues')
}

/** Ensure the data directory is fully bootstrapped (dirs + seed files). */
export function ensureBootstrapped(dataDir) {
    const issuesDir = path.join(dataDir, 'issues')
    if (!fs.existsSync(issuesDir)) {
        fs.mkdirSync(issuesDir, { recursive: true })
    }
    const metaPath = path.join(dataDir, '.meta.json')
    if (!fs.existsSync(metaPath)) {
        writeJSON(metaPath, { nextId: 1, createdAt: new Date().toISOString(), lastSyncedAt: null })
    }
    const boardPath = path.join(dataDir, 'board.json')
    if (!fs.existsSync(boardPath)) {
        writeJSON(boardPath, DEFAULT_BOARD)
    }
}

export function loadIssue(id, req) {
    const issuesDir = getIssuesDir(req)
    const jsonPath = path.join(issuesDir, `${id}.json`)
    const mdPath = path.join(issuesDir, `${id}.md`)
    if (!fs.existsSync(jsonPath)) return null
    const meta = readJSON(jsonPath)
    meta.description = readMD(mdPath)
    return meta
}

export function loadAllIssues(req) {
    const issuesDir = getIssuesDir(req)
    ensureBootstrapped(getDataDir(req))
    const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.json'))
    return files.map(f => {
        const id = path.basename(f, '.json')
        return loadIssue(id, req)
    }).filter(Boolean).sort((a, b) => a.id - b.id)
}

export function getNextId(req) {
    const dataDir = getDataDir(req)
    const metaPath = path.join(dataDir, '.meta.json')
    const meta = readJSON(metaPath)
    const id = meta.nextId
    meta.nextId = id + 1
    writeJSON(metaPath, meta)
    return id
}
