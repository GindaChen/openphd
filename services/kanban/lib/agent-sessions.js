// ── Agent Session Manager ──
// Manages long-lived pi-mono Agent instances keyed by session ID.
// Each session gets its own mailbox directory and agent instance.

import path from 'path'
import fs from 'fs'
import os from 'os'
import { createProjectMasterAgent } from './agent-engine.js'

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min inactivity

const sessions = new Map()

/**
 * Get or create an agent session.
 * @param {string} sessionId
 * @param {object} config - { provider, modelId, apiKey, systemPrompt }
 * @returns {{ agent, mailboxBase, sessionId }}
 */
export function getOrCreateSession(sessionId, config = {}) {
    if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId)
        session.lastAccess = Date.now()
        return session
    }

    const mailboxBase = path.join(os.tmpdir(), 'agent-sessions', sessionId)
    fs.mkdirSync(mailboxBase, { recursive: true })

    const agent = createProjectMasterAgent({
        ...config,
        mailboxBase,
    })

    const session = {
        sessionId,
        agent,
        mailboxBase,
        createdAt: Date.now(),
        lastAccess: Date.now(),
    }

    sessions.set(sessionId, session)
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
 * Destroy a session and clean up.
 */
export function destroySession(sessionId) {
    const session = sessions.get(sessionId)
    if (!session) return false
    try { fs.rmSync(session.mailboxBase, { recursive: true, force: true }) } catch { }
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
