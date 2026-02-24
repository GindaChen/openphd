// ── Agent Session Manager ──
// Manages long-lived pi-mono Agent instances keyed by session ID.
// Each session persists to .agents/agents/<id>/ via agent-store.

import path from 'path'
import fs from 'fs'
import { createProjectMasterAgent } from './agent-engine.js'
import { createAgent as createAgentDir, updateAgentStatus, getAgentsBase } from './agent-store.js'

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min inactivity

const sessions = new Map()

/**
 * Get or create an agent session.
 * @param {string} sessionId
 * @param {object} config - { provider, modelId, apiKey, systemPrompt, projectRoot }
 * @returns {{ agent, mailboxBase, sessionId }}
 */
export function getOrCreateSession(sessionId, config = {}) {
    if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId)
        // Recreate if LLM config changed (user updated settings)
        const configKey = `${config.provider || ''}:${config.modelId || ''}:${config.apiKey || ''}`
        if (session._configKey && session._configKey !== configKey) {
            destroySession(sessionId)
        } else {
            session.lastAccess = Date.now()
            return session
        }
    }

    // Persist agent directory under .agents/agents/<sessionId>/
    const agentsBase = getAgentsBase(config.projectRoot)
    const agentDir = path.join(agentsBase, sessionId)

    // Create persistent directory if it doesn't exist
    if (!fs.existsSync(path.join(agentDir, 'config.json'))) {
        createAgentDir({
            agentId: sessionId,
            type: config.type || 'master',
            provider: config.provider || 'anthropic',
            model: config.modelId || 'claude-sonnet-4-6',
        }, agentsBase)
    }

    // Use the agent directory as the mailbox base
    const mailboxBase = agentsBase

    const agent = createProjectMasterAgent({
        ...config,
        mailboxBase,
    })

    const session = {
        sessionId,
        agent,
        mailboxBase,
        agentDir,
        _configKey: `${config.provider || ''}:${config.modelId || ''}:${config.apiKey || ''}`,
        createdAt: Date.now(),
        lastAccess: Date.now(),
    }

    sessions.set(sessionId, session)

    // Update status to running
    updateAgentStatus(sessionId, { status: 'running' }, agentsBase)

    return session
}

/**
 * List all active sessions.
 */
export function listSessions() {
    return Array.from(sessions.entries()).map(([id, s]) => ({
        sessionId: id,
        createdAt: s.createdAt,
        lastAccess: s.lastAccess,
        ageSec: Math.round((Date.now() - s.createdAt) / 1000),
    }))
}

/**
 * Destroy a session and clean up the in-memory state.
 * Note: persistent directory is NOT deleted (preserved for memory/history).
 */
export function destroySession(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) return false

    // Update status to stopped but don't delete the directory
    try {
        const agentsBase = path.dirname(session.agentDir)
        updateAgentStatus(sessionId, { status: 'stopped' }, agentsBase)
    } catch { }

    sessions.delete(sessionId)
    return true
}

/**
 * Clean up sessions that have been idle past the TTL.
 */
export function cleanupSessions() {
    const now = Date.now()
    for (const [id, session] of sessions) {
        if (now - session.lastAccess > SESSION_TTL_MS) {
            destroySession(id)
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupSessions, 5 * 60 * 1000).unref()
