import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../store/api'
import { renderMarkdown } from '../../lib/markdown'

// ─────────────────────────────────────────────────────────
// AgentSoulPanel — Displays agent persona, memory, identity, tools
//
// The "soul" of an agent: a living markdown document that
// defines who this agent is, what it knows, and its capabilities.
// ─────────────────────────────────────────────────────────

const TOOL_ICONS = {
    kanban: '📋',
    coding: '💻',
    communication: '📡',
    orchestration: '🎯',
}

const TOOL_DESCRIPTIONS = {
    kanban: 'Board management — create, move, list issues',
    coding: 'Code execution, file operations, testing',
    communication: 'Inter-agent messaging and coordination',
    orchestration: 'Agent spawning, monitoring, and delegation',
}

// ── Soul Editor (inline markdown editor with live preview) ──

function SoulEditor({ soul, onSave, saving }) {
    const [content, setContent] = useState(soul || '')
    const [mode, setMode] = useState('preview') // 'preview' | 'edit'
    const textareaRef = useRef(null)

    useEffect(() => { setContent(soul || '') }, [soul])

    useEffect(() => {
        if (mode === 'edit' && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [mode])

    return (
        <div className="soul-editor">
            <div className="soul-editor-tabs">
                <button
                    className={`soul-editor-tab ${mode === 'preview' ? 'soul-editor-tab--active' : ''}`}
                    onClick={() => setMode('preview')}
                >
                    👁 Preview
                </button>
                <button
                    className={`soul-editor-tab ${mode === 'edit' ? 'soul-editor-tab--active' : ''}`}
                    onClick={() => setMode('edit')}
                >
                    ✏️ Edit
                </button>
                {mode === 'edit' && (
                    <button
                        className="soul-editor-save"
                        onClick={() => onSave(content)}
                        disabled={saving || content === soul}
                    >
                        {saving ? '⏳' : '💾'} Save
                    </button>
                )}
            </div>

            {mode === 'preview' ? (
                <div className="soul-editor-preview">
                    {content ? (
                        <div
                            className="soul-editor-rendered"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                        />
                    ) : (
                        <div className="soul-editor-empty">
                            <span className="soul-editor-empty-icon">🪶</span>
                            <p>No soul defined yet.</p>
                            <p className="soul-editor-empty-hint">
                                Fork a template or write one from scratch to give this agent its identity.
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    className="soul-editor-textarea"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="# Agent Soul\n\nDefine this agent's identity, principles, capabilities, and memory..."
                    spellCheck={false}
                />
            )}
        </div>
    )
}

// ── Template Picker ──

function TemplatePicker({ templates, onFork, forking }) {
    if (!templates.length) return null
    return (
        <div className="soul-templates">
            <div className="soul-templates-header">
                <span className="soul-templates-title">🧬 Soul Templates</span>
                <span className="soul-templates-hint">Fork a template to get started</span>
            </div>
            <div className="soul-templates-grid">
                {templates.map(t => (
                    <button
                        key={t.name}
                        className="soul-template-card"
                        onClick={() => onFork(t.name)}
                        disabled={forking}
                        title={`Fork "${t.name}" template`}
                    >
                        <span className="soul-template-icon">
                            {t.name === 'master' ? '👑' :
                                t.name === 'worker' ? '⚙️' :
                                    t.name === 'code-agent' ? '💻' :
                                        t.name === 'workspace-main' ? '🏠' :
                                            t.name === 'project-master' ? '🎯' : '🤖'}
                        </span>
                        <span className="soul-template-name">{t.name}</span>
                        <span className="soul-template-lines">{t.content.split('\n').length} lines</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Tools Panel ──

function ToolsPanel({ toolsData }) {
    const [expandedCat, setExpandedCat] = useState(null)

    if (!toolsData) return null

    return (
        <div className="soul-tools">
            <div className="soul-tools-header">
                <span className="soul-tools-title">🔧 Available Tools</span>
                <span className="soul-tools-count">{
                    (toolsData.categories?.reduce((n, c) => n + c.tools.length, 0) || 0) +
                    (toolsData.agentTools?.length || 0)
                } total</span>
            </div>

            {/* Tool categories from filesystem */}
            {toolsData.categories?.map(cat => (
                <div key={cat.category} className="soul-tool-category">
                    <button
                        className="soul-tool-category-header"
                        onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
                    >
                        <span className="soul-tool-category-icon">{TOOL_ICONS[cat.category] || '🔌'}</span>
                        <span className="soul-tool-category-name">{cat.category}</span>
                        <span className="soul-tool-category-count">{cat.tools.length}</span>
                        <span className="soul-tool-category-arrow">{expandedCat === cat.category ? '▾' : '▸'}</span>
                    </button>
                    {cat.category === expandedCat && (
                        <div className="soul-tool-category-desc">
                            {TOOL_DESCRIPTIONS[cat.category] && (
                                <div className="soul-tool-desc-text">{TOOL_DESCRIPTIONS[cat.category]}</div>
                            )}
                            {cat.tools.map(tool => (
                                <div key={tool} className="soul-tool-item">
                                    <span className="soul-tool-item-dot" />
                                    <span className="soul-tool-item-name">{tool}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {/* Agent LLM tools */}
            {toolsData.agentTools?.length > 0 && (
                <div className="soul-tool-category">
                    <button
                        className="soul-tool-category-header"
                        onClick={() => setExpandedCat(expandedCat === '_llm' ? null : '_llm')}
                    >
                        <span className="soul-tool-category-icon">🧠</span>
                        <span className="soul-tool-category-name">LLM Tools</span>
                        <span className="soul-tool-category-count">{toolsData.agentTools.length}</span>
                        <span className="soul-tool-category-arrow">{expandedCat === '_llm' ? '▾' : '▸'}</span>
                    </button>
                    {expandedCat === '_llm' && (
                        <div className="soul-tool-category-desc">
                            {toolsData.agentTools.map(tool => (
                                <div key={tool.name} className="soul-tool-item">
                                    <span className="soul-tool-item-dot" />
                                    <div>
                                        <span className="soul-tool-item-name">{tool.name}</span>
                                        {tool.description && (
                                            <div className="soul-tool-item-desc">{tool.description}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Agent Info Card ──

function AgentInfoCard({ agent }) {
    if (!agent) return null
    return (
        <div className="soul-info-card">
            <div className="soul-info-field">
                <span className="soul-info-label">ID</span>
                <span className="soul-info-value soul-info-mono">{agent.agentId}</span>
            </div>
            <div className="soul-info-field">
                <span className="soul-info-label">Type</span>
                <span className="soul-info-value">
                    <span className="soul-info-badge">{agent.type}</span>
                </span>
            </div>
            <div className="soul-info-field">
                <span className="soul-info-label">Model</span>
                <span className="soul-info-value soul-info-mono">{agent.model || '—'}</span>
            </div>
            <div className="soul-info-field">
                <span className="soul-info-label">Provider</span>
                <span className="soul-info-value">{agent.provider || '—'}</span>
            </div>
            {agent.workspace && (
                <div className="soul-info-field">
                    <span className="soul-info-label">Workspace</span>
                    <span className="soul-info-value">{agent.workspace}</span>
                </div>
            )}
            <div className="soul-info-field">
                <span className="soul-info-label">Created</span>
                <span className="soul-info-value">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : '—'}</span>
            </div>
        </div>
    )
}

// ── Main Soul Panel ──

export default function AgentSoulPanel({ agent }) {
    const [soul, setSoul] = useState('')
    const [templates, setTemplates] = useState([])
    const [toolsData, setToolsData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [forking, setForking] = useState(false)
    const [activeTab, setActiveTab] = useState('soul') // 'soul' | 'tools' | 'info'

    // Load soul + templates + tools on agent change
    useEffect(() => {
        if (!agent?.agentId) return
        setLoading(true)
        Promise.all([
            apiFetch(`/agents/detail/${agent.agentId}/soul`).catch(() => ({ soul: '' })),
            apiFetch('/agents/soul-templates').catch(() => []),
            apiFetch('/agents/tools').catch(() => null),
        ]).then(([soulData, tplData, toolData]) => {
            setSoul(soulData?.soul || '')
            setTemplates(Array.isArray(tplData) ? tplData : [])
            setToolsData(toolData)
            setLoading(false)
        })
    }, [agent?.agentId])

    const handleSave = useCallback(async (content) => {
        if (!agent?.agentId) return
        setSaving(true)
        try {
            await apiFetch(`/agents/detail/${agent.agentId}/soul`, {
                method: 'PUT',
                body: JSON.stringify({ soul: content }),
            })
            setSoul(content)
        } catch { /* ignore */ }
        setSaving(false)
    }, [agent?.agentId])

    const handleFork = useCallback(async (templateName) => {
        if (!agent?.agentId) return
        setForking(true)
        try {
            await apiFetch(`/agents/detail/${agent.agentId}/soul/fork`, {
                method: 'POST',
                body: JSON.stringify({ templateName }),
            })
            // Reload soul
            const data = await apiFetch(`/agents/detail/${agent.agentId}/soul`)
            setSoul(data?.soul || '')
        } catch { /* ignore */ }
        setForking(false)
    }, [agent?.agentId])

    if (!agent) {
        return (
            <div className="soul-panel-empty-state">
                <span className="soul-panel-empty-icon">🪶</span>
                <p>Select an agent to view its soul</p>
            </div>
        )
    }

    return (
        <div className="soul-panel">
            <div className="soul-panel-header">
                <span className="soul-panel-agent-name">{agent.displayName || agent.agentId}</span>
            </div>

            <div className="soul-panel-tabs">
                <button
                    className={`soul-panel-tab ${activeTab === 'soul' ? 'soul-panel-tab--active' : ''}`}
                    onClick={() => setActiveTab('soul')}
                >
                    🪶 Soul
                </button>
                <button
                    className={`soul-panel-tab ${activeTab === 'tools' ? 'soul-panel-tab--active' : ''}`}
                    onClick={() => setActiveTab('tools')}
                >
                    🔧 Tools
                </button>
                <button
                    className={`soul-panel-tab ${activeTab === 'info' ? 'soul-panel-tab--active' : ''}`}
                    onClick={() => setActiveTab('info')}
                >
                    ℹ️ Info
                </button>
            </div>

            <div className="soul-panel-content">
                {loading ? (
                    <div className="soul-panel-loading">Loading agent soul…</div>
                ) : activeTab === 'soul' ? (
                    <>
                        {!soul && <TemplatePicker templates={templates} onFork={handleFork} forking={forking} />}
                        <SoulEditor soul={soul} onSave={handleSave} saving={saving} />
                        {soul && <TemplatePicker templates={templates} onFork={handleFork} forking={forking} />}
                    </>
                ) : activeTab === 'tools' ? (
                    <ToolsPanel toolsData={toolsData} />
                ) : (
                    <AgentInfoCard agent={agent} />
                )}
            </div>
        </div>
    )
}
