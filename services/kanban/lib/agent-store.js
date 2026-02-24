// ── Agent Store — persistent agent directories ──
// Each agent gets: .agents/agents/<id>/{config.json, status.json, inbox.jsonl, outbox.jsonl, history.json}

import fs from 'fs'
import path from 'path'
import { generateAgentId, parseAgentId } from './agent-id.js'

const DEFAULT_AGENTS_BASE = path.resolve(process.cwd(), '.agents', 'agents')

/**
 * Get the base directory for all agents.
 * @param {string} [projectRoot] — project root override
 * @returns {string}
 */
export function getAgentsBase(projectRoot) {
    if (projectRoot && path.isAbsolute(projectRoot)) {
        return path.join(projectRoot, '.agents', 'agents')
    }
    return DEFAULT_AGENTS_BASE
}

/**
 * Create a new persistent agent directory.
 * @param {object} config — { type, soul, model, provider, workspace, parentId, ... }
 * @param {string} [baseDir] — override base directory
 * @returns {{ agentId: string, agentDir: string, config: object }}
 */
export function createAgent(config = {}, baseDir = DEFAULT_AGENTS_BASE) {
    const agentId = config.agentId || generateAgentId()
    const agentDir = path.join(baseDir, agentId)
    fs.mkdirSync(agentDir, { recursive: true })

    const agentConfig = {
        agentId,
        type: config.type || 'master',
        displayName: parseAgentId(agentId)?.displayName || agentId,
        soul: config.soul || null,
        provider: config.provider || 'anthropic',
        model: config.model || 'claude-sonnet-4-6',
        workspace: config.workspace || null,
        parentId: config.parentId || null,
        createdAt: new Date().toISOString(),
    }

    // Write config
    fs.writeFileSync(path.join(agentDir, 'config.json'), JSON.stringify(agentConfig, null, 2))

    // Initialize empty files
    fs.writeFileSync(path.join(agentDir, 'status.json'), JSON.stringify({
        agentId,
        status: 'created',
        lastAccess: Date.now(),
    }, null, 2))
    if (!fs.existsSync(path.join(agentDir, 'inbox.jsonl'))) fs.writeFileSync(path.join(agentDir, 'inbox.jsonl'), '')
    if (!fs.existsSync(path.join(agentDir, 'outbox.jsonl'))) fs.writeFileSync(path.join(agentDir, 'outbox.jsonl'), '')
    if (!fs.existsSync(path.join(agentDir, 'history.json'))) fs.writeFileSync(path.join(agentDir, 'history.json'), '[]')

    return { agentId, agentDir, config: agentConfig }
}

/**
 * Load a single agent's config + status.
 * @param {string} agentId
 * @param {string} [baseDir]
 * @returns {object|null}
 */
export function loadAgent(agentId, baseDir = DEFAULT_AGENTS_BASE) {
    const agentDir = path.join(baseDir, agentId)
    const configPath = path.join(agentDir, 'config.json')
    if (!fs.existsSync(configPath)) return null

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const statusPath = path.join(agentDir, 'status.json')
        const status = fs.existsSync(statusPath)
            ? JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
            : { status: 'unknown' }
        return { ...config, ...status, agentDir }
    } catch {
        return null
    }
}

/**
 * List all persisted agents.
 * @param {string} [baseDir]
 * @returns {Array<object>}
 */
export function listAgents(baseDir = DEFAULT_AGENTS_BASE) {
    if (!fs.existsSync(baseDir)) return []

    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    const agents = []

    for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name === 'memory') continue // skip shared memory dir
        const agent = loadAgent(entry.name, baseDir)
        if (agent) agents.push(agent)
    }

    // Sort by creation, newest first
    agents.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return agents
}

/**
 * Update an agent's status.
 * @param {string} agentId
 * @param {object} updates — fields to merge into status.json
 * @param {string} [baseDir]
 */
export function updateAgentStatus(agentId, updates, baseDir = DEFAULT_AGENTS_BASE) {
    const agentDir = path.join(baseDir, agentId)
    const statusPath = path.join(agentDir, 'status.json')
    let existing = {}
    try { existing = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) } catch { }
    const merged = { ...existing, ...updates, lastAccess: Date.now() }
    fs.writeFileSync(statusPath, JSON.stringify(merged, null, 2))
    return merged
}

/**
 * Save conversation history for an agent.
 */
export function saveHistory(agentId, messages, baseDir = DEFAULT_AGENTS_BASE) {
    const histPath = path.join(baseDir, agentId, 'history.json')
    fs.writeFileSync(histPath, JSON.stringify(messages, null, 2))
}

/**
 * Load conversation history for an agent.
 */
export function loadHistory(agentId, baseDir = DEFAULT_AGENTS_BASE) {
    const histPath = path.join(baseDir, agentId, 'history.json')
    try { return JSON.parse(fs.readFileSync(histPath, 'utf-8')) } catch { return [] }
}

/**
 * Delete an agent directory.
 * @param {string} agentId
 * @param {string} [baseDir]
 * @returns {boolean}
 */
export function deleteAgent(agentId, baseDir = DEFAULT_AGENTS_BASE) {
    const agentDir = path.join(baseDir, agentId)
    if (!fs.existsSync(agentDir)) return false
    fs.rmSync(agentDir, { recursive: true, force: true })
    return true
}
