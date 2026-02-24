// ── API helpers for kanban backend ──
import { loadSettings } from './settings'

const API = '/api/kanban'

function buildHeaders(opts = {}) {
    const settings = loadSettings()
    const headers = {
        'Content-Type': 'application/json',
        ...opts.headers,
    }
    if (settings.githubToken) headers['X-GitHub-Token'] = settings.githubToken
    if (settings.githubRepo) headers['X-GitHub-Repo'] = settings.githubRepo
    if (settings.llmApiKey) headers['X-LLM-API-Key'] = settings.llmApiKey
    if (settings.llmModel) headers['X-LLM-Model'] = settings.llmModel
    if (settings.llmBaseUrl) headers['X-LLM-Base-URL'] = settings.llmBaseUrl
    if (settings.projectRoot) headers['X-Project-Root'] = settings.projectRoot
    return headers
}

export async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        ...opts,
        headers: buildHeaders(opts),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res.json()
}

/**
 * Streaming fetch for SSE endpoints — returns raw Response for stream consumption.
 */
export async function apiStreamFetch(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
        ...opts,
        headers: buildHeaders(opts),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    return res
}
