import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../store/api'
import MemoryPanel from '../agents/MemoryPanel'

/**
 * ContextDashboard — Dynamic, AI-curated project dashboard.
 *
 * Widgets are loaded from /kanban/widgets API. The AI agent can:
 * - PATCH /kanban/widgets/:id to update a single widget
 * - PUT /kanban/widgets to replace all widgets
 * - POST custom widget types (the renderer handles unknown types as JSON)
 *
 * Supported types: list, issues, cluster, kv, chart, agents, markdown, html,
 *                  figure, wandb, runlog, script, custom
 */

// ── Fallback widgets (if API is unreachable) ──
const FALLBACK_WIDGETS = [
    { id: 'goals', title: 'Project Goals', icon: '🎯', type: 'list', items: [] },
]

// ══════════════════════════════════════════
//  Widget Type Renderers
// ══════════════════════════════════════════

function StatusDot({ status }) {
    const colors = {
        'in-progress': '#4ade80', active: '#4ade80', running: '#4ade80',
        planned: '#60a5fa', pending: '#60a5fa',
        verified: '#a78bfa', done: '#a78bfa', completed: '#a78bfa',
        high: '#f87171', critical: '#ef4444',
        medium: '#fbbf24', warning: '#fbbf24',
        low: '#60a5fa', info: '#60a5fa',
    }
    return <span className="ctx-status-dot" style={{ background: colors[status] || '#666' }} title={status} />
}

function ListWidget({ items }) {
    if (!items?.length) return <div className="ctx-widget-empty">Nothing here yet.</div>
    return (
        <ul className="ctx-widget-list">
            {items.map((item, i) => (
                <li key={i} className="ctx-widget-list-item">
                    {item.status && <StatusDot status={item.status} />}
                    <span>{item.text || item.label || item.content || JSON.stringify(item)}</span>
                </li>
            ))}
        </ul>
    )
}

function IssuesWidget({ items }) {
    if (!items?.length) return <div className="ctx-widget-empty">No items.</div>
    return (
        <ul className="ctx-widget-list">
            {items.map((item, i) => (
                <li key={i} className="ctx-widget-list-item ctx-widget-issue">
                    {item.priority && <StatusDot status={item.priority} />}
                    {item.id && <span className="ctx-issue-id">{item.id}</span>}
                    <span className="ctx-issue-title">{item.title || item.text}</span>
                    {item.label && <span className="ctx-issue-label">{item.label}</span>}
                </li>
            ))}
        </ul>
    )
}

function KVWidget({ data }) {
    if (!data || typeof data !== 'object') return <div className="ctx-widget-empty">No data.</div>
    return (
        <div className="ctx-cluster-grid">
            {Object.entries(data).map(([key, val]) => (
                <div key={key} className="ctx-cluster-stat">
                    <span className="ctx-cluster-stat-label">{key}</span>
                    <span className="ctx-cluster-stat-value">{typeof val === 'number' && key.toLowerCase().includes('util') ? `${val}%` : String(val)}</span>
                </div>
            ))}
        </div>
    )
}

function ChartWidget({ data, chartType }) {
    // Simple inline bar/sparkline chart rendered with CSS
    if (!data?.values?.length) return <div className="ctx-widget-empty">No chart data.</div>
    const values = data.values
    const maxVal = Math.max(...values.map(v => v.value || v))
    const labels = data.labels || values.map((_, i) => `${i + 1}`)

    return (
        <div className="ctx-chart">
            {data.title && <div className="ctx-chart-title">{data.title}</div>}
            <div className="ctx-chart-bars">
                {values.map((v, i) => {
                    const val = typeof v === 'number' ? v : v.value
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                    const color = v.color || 'var(--accent, #667eea)'
                    return (
                        <div key={i} className="ctx-chart-bar-wrap" title={`${labels[i]}: ${val}`}>
                            <div className="ctx-chart-bar" style={{ height: `${pct}%`, background: color }} />
                            <span className="ctx-chart-bar-label">{labels[i]}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function AgentsWidget({ items }) {
    if (!items?.length) return <div className="ctx-widget-empty">No agents configured.</div>
    return (
        <ul className="ctx-widget-list">
            {items.map((agent, i) => (
                <li key={i} className="ctx-widget-list-item ctx-agent-item">
                    <StatusDot status={agent.status || 'pending'} />
                    <span className="ctx-agent-name">{agent.name || agent.id}</span>
                    {agent.task && <span className="ctx-agent-task">{agent.task}</span>}
                    {agent.status && <span className="ctx-issue-label">{agent.status}</span>}
                </li>
            ))}
        </ul>
    )
}

function MarkdownWidget({ content }) {
    if (!content) return <div className="ctx-widget-empty">No content.</div>
    return <div className="ctx-widget-markdown">{content}</div>
}

function HtmlWidget({ html }) {
    if (!html) return <div className="ctx-widget-empty">No HTML content.</div>
    return <div className="ctx-widget-html" dangerouslySetInnerHTML={{ __html: html }} />
}

function FigureWidget({ widget }) {
    const src = widget.src || widget.url || widget.data?.url
    const caption = widget.caption || widget.data?.caption
    if (!src) return <div className="ctx-widget-empty">No image source.</div>
    return (
        <div className="ctx-figure">
            <img className="ctx-figure-img" src={src} alt={caption || widget.title || 'Figure'} loading="lazy" />
            {caption && <div className="ctx-figure-caption">{caption}</div>}
        </div>
    )
}

function WandbWidget({ widget }) {
    // Embeds a W&B chart/run via iframe
    const embedUrl = widget.embedUrl || widget.url || widget.data?.url
    const height = widget.height || widget.data?.height || 300
    if (!embedUrl) return <div className="ctx-widget-empty">Set <code>embedUrl</code> to a W&B share link.</div>
    return (
        <div className="ctx-wandb">
            <iframe
                className="ctx-wandb-iframe"
                src={embedUrl}
                style={{ height: `${height}px` }}
                frameBorder="0"
                allow="fullscreen"
                title={widget.title || 'W&B Chart'}
            />
        </div>
    )
}

function RunLogWidget({ widget }) {
    // Experiment run log — list of timestamped entries
    const entries = widget.entries || widget.items || widget.data?.entries || []
    if (!entries.length) return <div className="ctx-widget-empty">No log entries.</div>
    return (
        <div className="ctx-runlog">
            {entries.map((entry, i) => (
                <div key={i} className="ctx-runlog-entry">
                    {entry.timestamp && <span className="ctx-runlog-ts">{entry.timestamp}</span>}
                    <span className={`ctx-runlog-level ctx-runlog-level--${(entry.level || 'info').toLowerCase()}`}>
                        {(entry.level || 'INFO').toUpperCase()}
                    </span>
                    <span className="ctx-runlog-msg">{entry.message || entry.text || JSON.stringify(entry)}</span>
                </div>
            ))}
        </div>
    )
}

function ScriptWidget({ widget }) {
    // Loads a custom JS/HTML template from .agents/kanban/templates/<name>
    // Renders inside a sandboxed iframe for safety
    const iframeRef = useRef(null)
    const [templateHtml, setTemplateHtml] = useState(null)
    const templateName = widget.template || widget.data?.template
    const inlineScript = widget.script || widget.data?.script
    const inlineHtml = widget.html || widget.data?.html

    useEffect(() => {
        if (templateName) {
            // Fetch from .agents/kanban/templates/<name>
            apiFetch(`/widget-template-file?name=${encodeURIComponent(templateName)}`)
                .then(data => setTemplateHtml(data.html || data.content || ''))
                .catch(() => setTemplateHtml('<div style="color:#f87171;font-size:12px">Template not found</div>'))
        } else if (inlineScript || inlineHtml) {
            // Build inline template
            const html = inlineHtml || ''
            const script = inlineScript ? `<script>${inlineScript}<\/script>` : ''
            setTemplateHtml(`<div id="root">${html}</div>${script}`)
        }
    }, [templateName, inlineScript, inlineHtml])

    if (!templateName && !inlineScript && !inlineHtml) {
        return <div className="ctx-widget-empty">Set <code>template</code>, <code>script</code>, or <code>html</code>.</div>
    }
    if (templateHtml === null) return <div className="ctx-widget-empty">Loading template…</div>

    const srcdoc = `<!DOCTYPE html>
<html><head>
<style>body{margin:0;padding:8px;font-family:system-ui,sans-serif;font-size:12px;color:#ddd;background:transparent;}</style>
</head><body>${templateHtml}</body></html>`

    return (
        <iframe
            ref={iframeRef}
            className="ctx-script-iframe"
            srcDoc={srcdoc}
            sandbox="allow-scripts"
            style={{ width: '100%', height: widget.height || 120, border: 'none', borderRadius: '4px', background: 'var(--bg, #111)' }}
            title={widget.title || 'Script Widget'}
        />
    )
}

function CustomWidget({ widget }) {
    // Renders arbitrary JSON data as a formatted view
    const data = widget.data || widget.items || {}
    return (
        <pre className="ctx-widget-json">{JSON.stringify(data, null, 2)}</pre>
    )
}

// ══════════════════════════════════════════
//  Widget Card (type-dispatching + dual editing)
// ══════════════════════════════════════════

// Contextual editor — type-aware inline fields
function ContextualEditor({ widget, onSave, onCancel }) {
    const [draft, setDraft] = useState({ ...widget })
    const up = (key, val) => setDraft(prev => ({ ...prev, [key]: val }))

    const fieldRow = (label, key, type = 'text') => (
        <label className="ctx-edit-field">
            <span className="ctx-edit-field-label">{label}</span>
            {type === 'textarea' ? (
                <textarea className="ctx-widget-edit-textarea" value={draft[key] || ''} onChange={e => up(key, e.target.value)} rows={4} />
            ) : (
                <input className="kb-settings-input" value={draft[key] || ''} onChange={e => up(key, e.target.value)} style={{ fontSize: '11px' }} />
            )}
        </label>
    )

    const renderFields = () => {
        switch (widget.type) {
            case 'markdown':
                return <>{fieldRow('Title', 'title')}{fieldRow('Content', 'content', 'textarea')}</>
            case 'html':
                return <>{fieldRow('Title', 'title')}{fieldRow('HTML', 'html', 'textarea')}</>
            case 'figure':
                return <>{fieldRow('Title', 'title')}{fieldRow('Image URL', 'src')}{fieldRow('Caption', 'caption')}</>
            case 'wandb':
                return <>{fieldRow('Title', 'title')}{fieldRow('Embed URL', 'embedUrl')}<label className="ctx-edit-field"><span className="ctx-edit-field-label">Height (px)</span><input className="kb-settings-input" type="number" value={draft.height || 300} onChange={e => up('height', parseInt(e.target.value))} style={{ fontSize: '11px', width: '80px' }} /></label></>
            case 'script':
                return <>{fieldRow('Title', 'title')}{fieldRow('Template Name', 'template')}{fieldRow('Or Inline Script', 'script', 'textarea')}<label className="ctx-edit-field"><span className="ctx-edit-field-label">Height (px)</span><input className="kb-settings-input" type="number" value={draft.height || 120} onChange={e => up('height', parseInt(e.target.value))} style={{ fontSize: '11px', width: '80px' }} /></label></>
            case 'list':
            case 'alerts':
                return <>{fieldRow('Title', 'title')}<label className="ctx-edit-field"><span className="ctx-edit-field-label">Items (one per line)</span><textarea className="ctx-widget-edit-textarea" rows={5} value={(draft.items || []).map(it => it.text || it.label || '').join('\n')} onChange={e => up('items', e.target.value.split('\n').filter(Boolean).map(text => ({ text, status: 'planned' })))} /></label></>
            case 'chart':
                return <>{fieldRow('Title', 'title')}<label className="ctx-edit-field"><span className="ctx-edit-field-label">Chart Data (JSON)</span><textarea className="ctx-widget-edit-textarea" rows={6} value={JSON.stringify(draft.data || {}, null, 2)} onChange={e => { try { up('data', JSON.parse(e.target.value)) } catch { } }} /></label></>
            default:
                return <>{fieldRow('Title', 'title')}{fieldRow('Icon', 'icon')}</>
        }
    }

    return (
        <div className="ctx-widget-edit">
            {renderFields()}
            <div className="ctx-widget-edit-actions">
                <button className="ctx-widget-edit-btn ctx-widget-edit-save" onClick={() => onSave(draft)}>Save</button>
                <button className="ctx-widget-edit-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    )
}

function WidgetCard({ widget, collapsed, onToggle, onUpdate, onDelete }) {
    const [editMode, setEditMode] = useState(null)  // null | 'contextual' | 'json'
    const [editJson, setEditJson] = useState('')

    const startJsonEdit = (e) => {
        e.stopPropagation()
        setEditJson(JSON.stringify(widget, null, 2))
        setEditMode('json')
    }

    const startContextualEdit = (e) => {
        e.stopPropagation()
        setEditMode('contextual')
    }

    const saveJsonEdit = async () => {
        try {
            const parsed = JSON.parse(editJson)
            await onUpdate(parsed)
            setEditMode(null)
        } catch (err) {
            alert('Invalid JSON: ' + err.message)
        }
    }

    const saveContextualEdit = async (draft) => {
        await onUpdate(draft)
        setEditMode(null)
    }

    const renderBody = () => {
        if (editMode === 'json') {
            return (
                <div className="ctx-widget-edit">
                    <textarea
                        className="ctx-widget-edit-textarea"
                        value={editJson}
                        onChange={e => setEditJson(e.target.value)}
                        rows={10}
                    />
                    <div className="ctx-widget-edit-actions">
                        <button className="ctx-widget-edit-btn ctx-widget-edit-save" onClick={saveJsonEdit}>Save</button>
                        <button className="ctx-widget-edit-btn" onClick={() => setEditMode(null)}>Cancel</button>
                    </div>
                </div>
            )
        }

        if (editMode === 'contextual') {
            return <ContextualEditor widget={widget} onSave={saveContextualEdit} onCancel={() => setEditMode(null)} />
        }

        switch (widget.type) {
            case 'cluster': return <KVWidget data={widget.data} />
            case 'list': return <ListWidget items={widget.items} />
            case 'issues': return <IssuesWidget items={widget.items} />
            case 'jobs': return (widget.items?.length ? <ListWidget items={widget.items} /> : <div className="ctx-widget-empty">No running jobs.</div>)
            case 'alerts': return (widget.items?.length ? <ListWidget items={widget.items} /> : <div className="ctx-widget-empty">No pending alerts.</div>)
            case 'kv': return <KVWidget data={widget.data} />
            case 'chart': return <ChartWidget data={widget.data} chartType={widget.chartType} />
            case 'agents': return <AgentsWidget items={widget.items} />
            case 'markdown': return <MarkdownWidget content={widget.content} />
            case 'html': return <HtmlWidget html={widget.html} />
            case 'figure': return <FigureWidget widget={widget} />
            case 'wandb': return <WandbWidget widget={widget} />
            case 'runlog': return <RunLogWidget widget={widget} />
            case 'script': return <ScriptWidget widget={widget} />
            default: return <CustomWidget widget={widget} />
        }
    }

    return (
        <div className={`ctx-widget ${editMode ? 'ctx-widget--editing' : ''}`}>
            <div className="ctx-widget-header" onClick={onToggle}>
                <span className="ctx-widget-icon">{widget.icon || '📦'}</span>
                <span className="ctx-widget-title">{widget.title || widget.id}</span>
                {widget.badge && <span className="ctx-widget-badge">{widget.badge}</span>}
                <div className="ctx-widget-actions" onClick={e => e.stopPropagation()}>
                    <button className="ctx-widget-action-btn" onClick={startContextualEdit} title="Edit widget">✎</button>
                    <button className="ctx-widget-action-btn" onClick={startJsonEdit} title="Edit JSON">{'{}'}</button>
                    <button className="ctx-widget-action-btn ctx-widget-action-delete" onClick={() => onDelete(widget.id)} title="Delete widget">×</button>
                </div>
                <span className="ctx-widget-chevron">{collapsed ? '▸' : '▾'}</span>
            </div>
            {!collapsed && <div className="ctx-widget-body">{renderBody()}</div>}
        </div>
    )
}

// ══════════════════════════════════════════
//  Add Widget Menu (templates from API)
// ══════════════════════════════════════════

// Minimal built-in fallback if API fails
const BUILTIN_TEMPLATES = [
    { id: 'list', label: 'List', icon: '📝', category: 'core', template: { type: 'list', title: 'New List', icon: '📝', items: [] } },
    { id: 'quick-note', label: 'Quick Note', icon: '📄', category: 'core', template: { type: 'markdown', title: 'Quick Note', icon: '📄', content: '' } },
    { id: 'custom', label: 'Custom JSON', icon: '🔧', category: 'core', template: { type: 'custom', title: 'Custom Widget', icon: '🔧', data: {} } },
]

const CATEGORY_LABELS = {
    core: '⚙️ Core',
    exploration: '🔬 Exploration',
    data: '🗄️ Data',
    experiment: '🧪 Experiment',
    analysis: '📈 Analysis',
    writing: '📝 Writing',
    deployment: '🚀 Deployment',
    meta: '🔄 Meta',
}

function AddWidgetMenu({ onAdd, onClose }) {
    const [templates, setTemplates] = useState(BUILTIN_TEMPLATES)
    const [filter, setFilter] = useState('')

    useEffect(() => {
        apiFetch('/widget-templates')
            .then(data => { if (Array.isArray(data) && data.length) setTemplates(data) })
            .catch(() => { /* keep builtins */ })
    }, [])

    const filtered = filter
        ? templates.filter(t => t.label.toLowerCase().includes(filter.toLowerCase()) || (t.category || '').includes(filter.toLowerCase()))
        : templates

    // Group by category
    const grouped = {}
    for (const t of filtered) {
        const cat = t.category || 'core'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(t)
    }

    const categoryOrder = ['core', 'exploration', 'data', 'experiment', 'analysis', 'writing', 'deployment', 'meta']
    const sortedCategories = categoryOrder.filter(c => grouped[c])

    return (
        <div className="ctx-add-menu">
            <div className="ctx-add-menu-header">
                <span>Add Widget</span>
                <span className="ctx-add-menu-count">{filtered.length} templates</span>
            </div>
            <input
                className="ctx-add-menu-search"
                placeholder="Search templates..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                autoFocus
            />
            <div className="ctx-add-menu-scroll">
                {sortedCategories.map(cat => (
                    <div key={cat} className="ctx-add-menu-category">
                        <div className="ctx-add-menu-category-label">{CATEGORY_LABELS[cat] || cat}</div>
                        <div className="ctx-add-menu-grid">
                            {grouped[cat].map(t => (
                                <button key={t.id} className="ctx-add-menu-item" onClick={() => { onAdd(t.template); onClose() }}>
                                    <span className="ctx-add-menu-icon">{t.icon}</span>
                                    <span className="ctx-add-menu-label">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                {sortedCategories.length === 0 && (
                    <div className="ctx-widget-empty" style={{ padding: '12px' }}>No matching templates</div>
                )}
            </div>
        </div>
    )
}

// ══════════════════════════════════════════
//  Dashboard Container
// ══════════════════════════════════════════

export default function ContextDashboard() {
    const [widgets, setWidgets] = useState(FALLBACK_WIDGETS)
    const [loading, setLoading] = useState(true)
    const [collapsedMap, setCollapsedMap] = useState({})
    const [allCollapsed, setAllCollapsed] = useState(false)
    const [showAddMenu, setShowAddMenu] = useState(false)
    const [columns, setColumns] = useState(() => {
        const saved = localStorage.getItem('ctx-dashboard-columns')
        return saved ? parseInt(saved) : 1
    })

    const cycleColumns = () => {
        const next = columns >= 3 ? 1 : columns + 1
        setColumns(next)
        localStorage.setItem('ctx-dashboard-columns', String(next))
    }

    const fetchWidgets = useCallback(async () => {
        try {
            const data = await apiFetch('/widgets')
            if (Array.isArray(data)) setWidgets(data)
        } catch { /* keep current */ }
        finally { setLoading(false) }
    }, [])

    useEffect(() => {
        fetchWidgets()
        const interval = setInterval(fetchWidgets, 10000)
        return () => clearInterval(interval)
    }, [fetchWidgets])

    const toggleAll = () => {
        const next = !allCollapsed
        setAllCollapsed(next)
        const map = {}
        widgets.forEach(w => { map[w.id] = next })
        setCollapsedMap(map)
    }

    const toggleOne = (id) => {
        setCollapsedMap(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const addWidget = async (template) => {
        const id = `w-${Date.now()}`
        const widget = { ...template, id }
        const updated = [...widgets, widget]
        setWidgets(updated)
        try { await apiFetch('/widgets', { method: 'PUT', body: JSON.stringify(updated) }) } catch { }
    }

    const updateWidget = async (widgetData) => {
        const updated = widgets.map(w => w.id === widgetData.id ? widgetData : w)
        setWidgets(updated)
        try { await apiFetch(`/widgets/${widgetData.id}`, { method: 'PATCH', body: JSON.stringify(widgetData) }) } catch { }
    }

    const deleteWidget = async (id) => {
        const updated = widgets.filter(w => w.id !== id)
        setWidgets(updated)
        try { await apiFetch(`/widgets/${id}`, { method: 'DELETE' }) } catch { }
    }

    return (
        <div className="ctx-dashboard">
            <div className="ctx-dashboard-header">
                <span className="ctx-dashboard-title">Contextual View</span>
                <div className="ctx-dashboard-actions">
                    <button
                        className="ctx-dashboard-action-btn"
                        onClick={cycleColumns}
                        title={`${columns} column${columns > 1 ? 's' : ''} — click to cycle`}
                    >
                        {'▮'.repeat(columns)}
                    </button>
                    <button
                        className="ctx-dashboard-action-btn"
                        onClick={toggleAll}
                        title={allCollapsed ? 'Expand all' : 'Collapse all'}
                    >
                        {allCollapsed ? '▸▸' : '▾▾'}
                    </button>
                    <button
                        className="ctx-dashboard-action-btn ctx-dashboard-add-btn"
                        onClick={() => setShowAddMenu(o => !o)}
                        title="Add widget"
                    >
                        ＋
                    </button>
                </div>
            </div>

            {showAddMenu && (
                <AddWidgetMenu
                    onAdd={addWidget}
                    onClose={() => setShowAddMenu(false)}
                />
            )}

            <div className="ctx-dashboard-widgets" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {loading && <div className="ctx-widget-empty" style={{ padding: '16px' }}>Loading...</div>}
                {widgets.map(w => (
                    <WidgetCard
                        key={w.id}
                        widget={w}
                        collapsed={collapsedMap[w.id] ?? false}
                        onToggle={() => toggleOne(w.id)}
                        onUpdate={updateWidget}
                        onDelete={deleteWidget}
                    />
                ))}
            </div>

            <MemoryPanel />
        </div>
    )
}
