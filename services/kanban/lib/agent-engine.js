// ── Agent Engine — factory for creating configured pi-mono Agents ──

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Agent } from '@mariozechner/pi-agent-core'
import { getModel, streamSimple, getEnvApiKey } from '@mariozechner/pi-ai'
import { createMasterTools, createWorkerTools, createCodingTools } from './tools/index.js'
import { DEFAULT_DATA_DIR } from './project.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Soul loader ──

/**
 * Load a soul template from souls/ and interpolate {{variables}}.
 * Falls back to .agents/souls/{name}.md for project-level overrides.
 */
export function loadSoul(name, vars = {}) {
    // Check project-level overrides first
    const overridePath = path.resolve(process.cwd(), '.agents', 'souls', `${name}.md`)
    const builtinPath = path.join(__dirname, 'souls', `${name}.md`)
    const soulPath = fs.existsSync(overridePath) ? overridePath : builtinPath
    let content = fs.readFileSync(soulPath, 'utf-8')

    // Interpolate {{key}} placeholders
    for (const [key, value] of Object.entries(vars)) {
        const val = Array.isArray(value) ? value.join(', ') : String(value ?? '')
        content = content.replaceAll(`{{${key}}}`, val)
    }
    // Remove any remaining unmatched placeholders
    content = content.replace(/\{\{[^}]+\}\}/g, '')
    return content
}

// Backward compat alias
export const loadPrompt = (name) => loadSoul(name)

// ── Factory Functions ──

/**
 * Create the Project Master Agent — always-on, top-level orchestrator.
 */
export function createProjectMasterAgent(config = {}) {
    const {
        provider = 'anthropic',
        modelId = 'claude-sonnet-4-6',
        apiKey,
        mailboxBase,
        agentId = 'master',
        systemPrompt,
        dataDir = DEFAULT_DATA_DIR,
    } = config

    const model = getModel(provider, modelId)
    const tools = createMasterTools({ mailboxBase, dataDir })

    const soul = systemPrompt || loadSoul('project-master', { agentId })

    const agent = new Agent({
        streamFn: streamSimple,
        getApiKey: apiKey ? () => apiKey : (p) => getEnvApiKey(p),
    })

    agent.setModel(model)
    agent.setSystemPrompt(soul)
    agent.setTools(tools)

    return agent
}

/**
 * Create a Workspace Agent — scoped to a workspace and its issues.
 */
export function createWorkspaceAgent(config = {}) {
    const {
        provider = 'anthropic',
        modelId = 'claude-sonnet-4-6',
        apiKey,
        agentId,
        mailboxBase,
        workspace = '',
        issues = [],
        masterAgentId = 'master',
        context = '',
        workspaceDir,
    } = config

    const model = getModel(provider, modelId)

    // Workspace agents get orchestration tools (to spawn sub-agents)
    // + communication tools (to talk to master) + coding tools
    const workerTools = createWorkerTools({ agentId, mailboxBase })
    const masterTools = createMasterTools({ mailboxBase })
    const codingTools = createCodingTools({ workspaceDir: workspaceDir || process.cwd() })

    // Merge: dedup by tool name, worker tools take priority for sendToMaster
    const toolMap = new Map()
    for (const t of [...masterTools, ...codingTools, ...workerTools]) toolMap.set(t.name, t)
    const allTools = [...toolMap.values()]

    const soul = loadSoul('workspace-main', {
        agentId, workspace, issues, masterAgentId, context,
    })

    const agent = new Agent({
        streamFn: streamSimple,
        getApiKey: apiKey ? () => apiKey : (p) => getEnvApiKey(p),
    })

    agent.setModel(model)
    agent.setSystemPrompt(soul)
    agent.setTools(allTools)

    return agent
}

/**
 * Create a master agent with orchestration tools.
 * @deprecated Use createProjectMasterAgent instead.
 */
export function createMasterAgent(config = {}) {
    return createProjectMasterAgent(config)
}

/**
 * Create a worker/sub-agent with communication tools.
 * type='code' auto-includes coding tools.
 */
export function createWorkerAgent(config = {}) {
    const {
        provider = 'anthropic',
        modelId = 'claude-sonnet-4-6',
        apiKey,
        agentId,
        mailboxBase,
        workspaceDir,
        type = 'general',
        task = '',
        extraTools = [],
    } = config

    const model = getModel(provider, modelId)
    const workerTools = createWorkerTools({ agentId, mailboxBase })
    const codingTools = type === 'code'
        ? createCodingTools({ workspaceDir: workspaceDir || process.cwd() })
        : []
    const allTools = [...workerTools, ...codingTools, ...extraTools]

    const promptName = type === 'code' ? 'code-agent' : 'worker'
    const sysPrompt = loadSoul(promptName, { agentId, task })

    const agent = new Agent({
        streamFn: streamSimple,
        getApiKey: apiKey ? () => apiKey : (p) => getEnvApiKey(p),
    })

    agent.setModel(model)
    agent.setSystemPrompt(`${sysPrompt}\n\n## Your Task\n${task}`)
    agent.setTools(allTools)

    return agent
}

// Alias
export const createSubAgent = createWorkerAgent
