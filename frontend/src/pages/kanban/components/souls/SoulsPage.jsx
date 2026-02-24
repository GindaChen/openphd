import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../store/api'
import { renderMarkdown } from '../../lib/markdown'
import AgentSoulPanel from '../agents/AgentSoulPanel'

// ─────────────────────────────────────────────────────────
// SoulsPage — Global page for browsing, creating, and editing
// agent souls and templates.
//
// Left: soul template gallery + agent list
// Right: selected soul detail (preview/edit)
// ─────────────────────────────────────────────────────────

const TEMPLATE_ICONS = {
    master: '👑',
    worker: '⚙️',
    'code-agent': '💻',
    'workspace-main': '🏠',
    'project-master': '🎯',
}

export default function SoulsPage() {
    const [templates, setTemplates] = useState([])
    const [agents, setAgents] = useState([])
    const [toolsData, setToolsData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedType, setSelectedType] = useState('templates') // 'templates' | 'agents' | 'tools'
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [selectedAgent, setSelectedAgent] = useState(null)

    useEffect(() => {
        setLoading(true)
        Promise.all([
            apiFetch('/agents/soul-templates').catch(() => []),
            apiFetch('/agents/list').catch(() => []),
            apiFetch('/agents/tools').catch(() => null),
        ]).then(([tpls, ags, tools]) => {
            setTemplates(Array.isArray(tpls) ? tpls : [])
            setAgents(Array.isArray(ags) ? ags : [])
            setToolsData(tools)
            setLoading(false)
            // Auto-select first template if available
            if (tpls.length > 0 && !selectedTemplate) setSelectedTemplate(tpls[0])
        })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleForkToAgent = useCallback(async (agentId, templateName) => {
        try {
            await apiFetch(`/agents/detail/${agentId}/soul/fork`, {
                method: 'POST',
                body: JSON.stringify({ templateName }),
            })
            // Refresh agents after fork
            const ags = await apiFetch('/agents/list').catch(() => [])
            setAgents(Array.isArray(ags) ? ags : [])
        } catch { /* ignore */ }
    }, [])

    return (
        <div className="souls-page">
            {/* Left Panel — Soul Gallery */}
            <div className="souls-page-left">
                <div className="souls-page-left-header">
                    <h2 className="souls-page-title">🪶 Souls & Tools</h2>
                </div>

                {/* Section tabs */}
                <div className="souls-page-section-tabs">
                    <button
                        className={`souls-section-tab ${selectedType === 'templates' ? 'souls-section-tab--active' : ''}`}
                        onClick={() => { setSelectedType('templates'); setSelectedAgent(null) }}
                    >
                        🧬 Templates
                    </button>
                    <button
                        className={`souls-section-tab ${selectedType === 'agents' ? 'souls-section-tab--active' : ''}`}
                        onClick={() => { setSelectedType('agents'); setSelectedTemplate(null) }}
                    >
                        🤖 Agents
                    </button>
                    <button
                        className={`souls-section-tab ${selectedType === 'tools' ? 'souls-section-tab--active' : ''}`}
                        onClick={() => { setSelectedType('tools'); setSelectedTemplate(null); setSelectedAgent(null) }}
                    >
                        🔧 Tools
                    </button>
                </div>

                {loading ? (
                    <div className="souls-page-loading">Loading…</div>
                ) : selectedType === 'templates' ? (
                    <div className="souls-page-list">
                        {templates.map(t => (
                            <button
                                key={t.name}
                                className={`souls-card ${selectedTemplate?.name === t.name ? 'souls-card--selected' : ''}`}
                                onClick={() => { setSelectedTemplate(t); setSelectedAgent(null) }}
                            >
                                <span className="souls-card-icon">{TEMPLATE_ICONS[t.name] || '🤖'}</span>
                                <div className="souls-card-info">
                                    <span className="souls-card-name">{t.name}</span>
                                    <span className="souls-card-meta">{t.content.split('\n').length} lines</span>
                                </div>
                            </button>
                        ))}
                        {templates.length === 0 && (
                            <div className="souls-page-empty">No soul templates found in <code>lib/souls/</code></div>
                        )}
                    </div>
                ) : selectedType === 'agents' ? (
                    <div className="souls-page-list">
                        {agents.map(a => (
                            <button
                                key={a.agentId}
                                className={`souls-card ${selectedAgent?.agentId === a.agentId ? 'souls-card--selected' : ''}`}
                                onClick={() => { setSelectedAgent(a); setSelectedTemplate(null) }}
                            >
                                <span className="souls-card-icon">{a.type === 'master' ? '👑' : '🤖'}</span>
                                <div className="souls-card-info">
                                    <span className="souls-card-name">{a.displayName || a.agentId}</span>
                                    <span className="souls-card-meta">{a.type} · {a.model || '?'}</span>
                                </div>
                                {a.type === 'master' && <span className="souls-card-badge">M</span>}
                            </button>
                        ))}
                        {agents.length === 0 && (
                            <div className="souls-page-empty">No agents yet. Create one from the Agents view.</div>
                        )}
                    </div>
                ) : (
                    /* Tools section */
                    <div className="souls-page-list souls-page-tools-list">
                        {toolsData?.categories?.map(cat => (
                            <div key={cat.category} className="souls-tool-group">
                                <div className="souls-tool-group-header">
                                    <span className="souls-tool-group-icon">
                                        {cat.category === 'kanban' ? '📋' :
                                            cat.category === 'coding' ? '💻' :
                                                cat.category === 'communication' ? '📡' :
                                                    cat.category === 'orchestration' ? '🎯' : '🔌'}
                                    </span>
                                    <span className="souls-tool-group-name">{cat.category}</span>
                                    <span className="souls-tool-group-count">{cat.tools.length}</span>
                                </div>
                                {cat.tools.map(tool => (
                                    <div key={tool} className="souls-tool-entry">
                                        <span className="souls-tool-dot" />
                                        <span className="souls-tool-name">{tool}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {toolsData?.agentTools?.length > 0 && (
                            <div className="souls-tool-group">
                                <div className="souls-tool-group-header">
                                    <span className="souls-tool-group-icon">🧠</span>
                                    <span className="souls-tool-group-name">LLM Tools</span>
                                    <span className="souls-tool-group-count">{toolsData.agentTools.length}</span>
                                </div>
                                {toolsData.agentTools.map(tool => (
                                    <div key={tool.name} className="souls-tool-entry">
                                        <span className="souls-tool-dot" />
                                        <div>
                                            <span className="souls-tool-name">{tool.name}</span>
                                            {tool.description && (
                                                <div className="souls-tool-desc">{tool.description}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right Panel — Detail View */}
            <div className="souls-page-right">
                {selectedTemplate ? (
                    /* Template detail view */
                    <div className="souls-detail">
                        <div className="souls-detail-header">
                            <span className="souls-detail-icon">{TEMPLATE_ICONS[selectedTemplate.name] || '🤖'}</span>
                            <div>
                                <h3 className="souls-detail-name">{selectedTemplate.name}</h3>
                                <span className="souls-detail-meta">Template · {selectedTemplate.content.split('\n').length} lines</span>
                            </div>
                        </div>

                        {/* Fork to agent */}
                        {agents.length > 0 && (
                            <div className="souls-detail-fork">
                                <span className="souls-detail-fork-label">Fork to agent:</span>
                                <div className="souls-detail-fork-btns">
                                    {agents.map(a => (
                                        <button
                                            key={a.agentId}
                                            className="souls-detail-fork-btn"
                                            onClick={() => handleForkToAgent(a.agentId, selectedTemplate.name)}
                                            title={`Fork "${selectedTemplate.name}" soul to ${a.displayName}`}
                                        >
                                            {a.displayName || a.agentId}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="souls-detail-content">
                            <div
                                className="souls-detail-rendered"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedTemplate.content) }}
                            />
                        </div>
                    </div>
                ) : selectedAgent ? (
                    /* Agent soul editor */
                    <AgentSoulPanel agent={selectedAgent} />
                ) : (
                    <div className="souls-detail-empty">
                        <span className="souls-detail-empty-icon">🪶</span>
                        <p>Select a template or agent to view its soul</p>
                        <p className="souls-detail-empty-hint">
                            Templates define agent personas. Fork them to give agents their identity.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
