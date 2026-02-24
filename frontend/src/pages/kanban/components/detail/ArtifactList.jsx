import { useState, useEffect, useCallback } from 'react'
import FileTree from '../../../../components/ui/FileTree'
import { loadSettings } from '../../store/settings'

/* ─── Artifact Type Registry ─────────────────────────────────────────
   Not hardcoded — types are defined as structured objects.
   An AI agent can read this schema, add new types, or serialize
   artifact data unambiguously.
   ─────────────────────────────────────────────────────────────────── */

const DEFAULT_ARTIFACT_TYPES = [
    {
        id: 'file',
        label: 'File',
        icon: '📄',
        description: 'A file on disk',
        fields: [
            { key: 'name', label: 'Name', kind: 'text', required: true },
            { key: 'path', label: 'File path', kind: 'file-browser' },
        ],
    },
    {
        id: 'link',
        label: 'Link',
        icon: '🔗',
        description: 'An external URL',
        fields: [
            { key: 'name', label: 'Name', kind: 'text', required: true },
            { key: 'url', label: 'URL', kind: 'url', placeholder: 'https://...' },
        ],
    },
    {
        id: 'note',
        label: 'Note',
        icon: '📝',
        description: 'Free-form text note',
        fields: [
            { key: 'name', label: 'Title', kind: 'text', required: true },
            { key: 'content', label: 'Content', kind: 'textarea' },
        ],
    },
    {
        id: 'experiment',
        label: 'Experiment',
        icon: '🧪',
        description: 'An experiment with parameters & results',
        fields: [
            { key: 'name', label: 'Experiment name', kind: 'text', required: true },
            { key: 'hypothesis', label: 'Hypothesis', kind: 'textarea', placeholder: 'What are you testing?' },
            { key: 'path', label: 'Results path', kind: 'file-browser' },
        ],
    },
    {
        id: 'figure',
        label: 'Figure',
        icon: '📊',
        description: 'A visualization or chart image',
        fields: [
            { key: 'name', label: 'Caption', kind: 'text', required: true },
            { key: 'path', label: 'Image path', kind: 'file-browser' },
            { key: 'description', label: 'Description', kind: 'text', placeholder: 'Describe this figure' },
        ],
    },
    {
        id: 'metric',
        label: 'Metric',
        icon: '📐',
        description: 'A tracked metric or KPI',
        fields: [
            { key: 'name', label: 'Metric name', kind: 'text', required: true },
            { key: 'value', label: 'Value', kind: 'text', placeholder: '0.95' },
            { key: 'unit', label: 'Unit', kind: 'text', placeholder: 'accuracy, ms, %' },
        ],
    },
    {
        id: 'report',
        label: 'Report',
        icon: '📋',
        description: 'A report or write-up',
        fields: [
            { key: 'name', label: 'Report title', kind: 'text', required: true },
            { key: 'path', label: 'File path', kind: 'file-browser' },
            { key: 'summary', label: 'Summary', kind: 'textarea', placeholder: 'Brief summary…' },
        ],
    },
]

/* ─── Helpers ────────────────────────────────────────────────────── */

function getTypeById(types, id) {
    return types.find(t => t.id === id)
}

function getIcon(types, typeId) {
    return getTypeById(types, typeId)?.icon || '📎'
}

function emptyData(type) {
    const data = {}
    type?.fields?.forEach(f => { data[f.key] = '' })
    return data
}

/* ─── Filed-level Input Components ───────────────────────────────── */

function FieldInput({ field, value, onChange }) {
    if (field.kind === 'textarea') {
        return (
            <textarea
                className="kb-artifact-form-input kb-artifact-form-textarea"
                placeholder={field.placeholder || field.label}
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                rows={3}
            />
        )
    }
    if (field.kind === 'url') {
        return (
            <div className="kb-artifact-field-url">
                <span className="kb-artifact-field-url-icon">🌐</span>
                <input
                    className="kb-artifact-form-input"
                    type="url"
                    placeholder={field.placeholder || 'https://...'}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                />
            </div>
        )
    }
    // default: plain text
    return (
        <input
            className="kb-artifact-form-input"
            placeholder={field.placeholder || field.label}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    )
}

function FileBrowserField({ field, value, onChange, basePath }) {
    const [open, setOpen] = useState(false)
    const [browsePath, setBrowsePath] = useState('')
    const [browseDirs, setBrowseDirs] = useState([])
    const [browseParent, setBrowseParent] = useState('')
    const [browseError, setBrowseError] = useState(null)

    const handleBrowse = useCallback(async (targetPath) => {
        try {
            setBrowseError(null)
            const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
            const res = await fetch(`/api/kanban/browse${params}`)
            const data = await res.json()
            if (!res.ok) { setBrowseError(data.error); return }
            setBrowsePath(data.current)
            setBrowseParent(data.parent)
            setBrowseDirs(data.dirs)
        } catch (err) {
            setBrowseError(err.message)
        }
    }, [])

    useEffect(() => {
        if (open && !browsePath) handleBrowse(value || basePath || '')
    }, [open])

    return (
        <div className="kb-artifact-field-filebrowser">
            <div className="kb-artifact-field-filebrowser-row">
                <input
                    className="kb-artifact-form-input"
                    placeholder={field.placeholder || field.label}
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                />
                <button
                    type="button"
                    className="kb-artifact-form-btn kb-artifact-form-btn--browse"
                    onClick={() => setOpen(o => !o)}
                >📂</button>
            </div>
            {open && (
                <FileTree
                    currentPath={browsePath}
                    dirs={browseDirs}
                    parentPath={browseParent}
                    error={browseError}
                    onNavigate={handleBrowse}
                    onSelect={(path) => { onChange(path); setOpen(false) }}
                />
            )}
        </div>
    )
}

/* ─── Custom Type Creator ────────────────────────────────────────── */

function CustomTypeCreator({ onAdd, onCancel }) {
    const [label, setLabel] = useState('')
    const [icon, setIcon] = useState('📎')
    const QUICK_ICONS = ['📎', '🔬', '🧬', '📡', '🛰️', '⚡', '🎯', '💡', '🗂️', '🏷️']

    const handleCreate = () => {
        if (!label.trim()) return
        const id = label.trim().toLowerCase().replace(/\s+/g, '-')
        onAdd({
            id,
            label: label.trim(),
            icon,
            description: `Custom artifact type: ${label.trim()}`,
            fields: [
                { key: 'name', label: 'Name', kind: 'text', required: true },
                { key: 'value', label: 'Value', kind: 'text' },
                { key: 'path', label: 'File path', kind: 'file-browser' },
            ],
        })
    }

    return (
        <div className="kb-artifact-custom-type-creator">
            <div className="kb-artifact-custom-type-header">New Type</div>
            <div className="kb-artifact-custom-type-row">
                <div className="kb-artifact-custom-type-icons">
                    {QUICK_ICONS.map(ic => (
                        <button
                            key={ic}
                            type="button"
                            className={`kb-artifact-icon-btn ${ic === icon ? 'kb-artifact-icon-btn--selected' : ''}`}
                            onClick={() => setIcon(ic)}
                        >{ic}</button>
                    ))}
                </div>
                <input
                    className="kb-artifact-form-input"
                    placeholder="Type label (e.g. dataset, model)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="kb-artifact-form-actions">
                <button className="kb-artifact-form-btn kb-artifact-form-btn--save" onClick={handleCreate}>Create Type</button>
                <button className="kb-artifact-form-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    )
}

/* ─── Type Selector Dropdown ─────────────────────────────────────── */

function TypeSelector({ types, selectedId, onChange, onCreateNew }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="kb-artifact-type-selector">
            <button
                type="button"
                className="kb-artifact-type-selector-trigger"
                onClick={() => setOpen(!open)}
            >
                <span className="kb-artifact-type-selector-icon">{getIcon(types, selectedId)}</span>
                <span className="kb-artifact-type-selector-label">{getTypeById(types, selectedId)?.label || selectedId}</span>
                <span className="kb-artifact-type-selector-caret">▾</span>
            </button>
            {open && (
                <div className="kb-artifact-type-dropdown">
                    {types.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            className={`kb-artifact-type-option ${t.id === selectedId ? 'kb-artifact-type-option--selected' : ''}`}
                            onClick={() => { onChange(t.id); setOpen(false) }}
                        >
                            <span className="kb-artifact-type-option-icon">{t.icon}</span>
                            <span className="kb-artifact-type-option-label">{t.label}</span>
                            {t.id === selectedId && <span className="kb-artifact-type-option-check">✓</span>}
                        </button>
                    ))}
                    <div className="kb-artifact-type-divider" />
                    <button
                        type="button"
                        className="kb-artifact-type-option kb-artifact-type-option--create"
                        onClick={() => { onCreateNew(); setOpen(false) }}
                    >
                        <span className="kb-artifact-type-option-icon">＋</span>
                        <span className="kb-artifact-type-option-label">Custom type…</span>
                    </button>
                </div>
            )}
        </div>
    )
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function ArtifactList({ artifacts, onUpdate }) {
    const [types, setTypes] = useState(() => {
        // Load custom types from localStorage, merge with defaults
        try {
            const stored = JSON.parse(localStorage.getItem('kb-custom-artifact-types') || '[]')
            return [...DEFAULT_ARTIFACT_TYPES, ...stored]
        } catch { return DEFAULT_ARTIFACT_TYPES }
    })

    const [adding, setAdding] = useState(false)
    const [creatingType, setCreatingType] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [selectedType, setSelectedType] = useState('file')
    const [formData, setFormData] = useState({})
    // View modes: 'compact' | 'comfortable' | 'expanded'
    const [viewModes, setViewModes] = useState({})

    // Project root from Settings > Setup — used as base path for file browsers
    const projectRoot = loadSettings().projectRoot || ''

    const VIEW_CYCLE = ['compact', 'comfortable', 'expanded']
    const getViewMode = (id) => viewModes[id] || 'comfortable'
    const cycleView = (id) => {
        const current = getViewMode(id)
        const next = VIEW_CYCLE[(VIEW_CYCLE.indexOf(current) + 1) % VIEW_CYCLE.length]
        setViewModes(prev => ({ ...prev, [id]: next }))
    }

    const items = artifacts || []

    // Persist custom types
    const addCustomType = (newType) => {
        const updated = [...types, newType]
        setTypes(updated)
        // Only persist non-default types
        const custom = updated.filter(t => !DEFAULT_ARTIFACT_TYPES.find(d => d.id === t.id))
        localStorage.setItem('kb-custom-artifact-types', JSON.stringify(custom))
        setSelectedType(newType.id)
        setFormData(emptyData(newType))
        setCreatingType(false)
    }

    const handleTypeChange = (typeId) => {
        setSelectedType(typeId)
        const type = getTypeById(types, typeId)
        setFormData(emptyData(type))
    }

    const handleFieldChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }))
    }

    const handleAdd = () => {
        const type = getTypeById(types, selectedType)
        if (!formData.name?.trim()) return
        const artifact = {
            id: `art-${Date.now()}`,
            type: selectedType,
            icon: type?.icon || '📎',
            createdAt: new Date().toISOString(),
            data: { ...formData },
            // Legacy compat — surface key fields
            name: formData.name?.trim(),
            path: formData.path || undefined,
            url: formData.url || undefined,
            preview: formData.content || formData.summary || undefined,
        }
        onUpdate?.([...items, artifact])
        setFormData({})
        setSelectedType('file')
        setAdding(false)
    }

    const handleDelete = (id) => {
        onUpdate?.(items.filter(a => a.id !== id))
    }

    const handleEditStart = (artifact) => {
        setEditingId(artifact.id)
        setSelectedType(artifact.type || 'file')
        // Reconstruct formData from artifact.data or legacy fields
        if (artifact.data) {
            setFormData({ ...artifact.data })
        } else {
            setFormData({
                name: artifact.name || '',
                path: artifact.path || '',
                url: artifact.url || '',
                content: artifact.preview || '',
            })
        }
    }

    const handleEditSave = () => {
        const type = getTypeById(types, selectedType)
        onUpdate?.(items.map(a => {
            if (a.id !== editingId) return a
            return {
                ...a,
                type: selectedType,
                icon: type?.icon || '📎',
                data: { ...formData },
                name: formData.name?.trim(),
                path: formData.path || undefined,
                url: formData.url || undefined,
                preview: formData.content || formData.summary || undefined,
            }
        }))
        setEditingId(null)
        setFormData({})
    }

    /* ─── Render the type-specific form ─────────────────────────── */

    const renderForm = (onSubmit, submitLabel) => {
        const type = getTypeById(types, selectedType)
        const fields = type?.fields || [
            { key: 'name', label: 'Name', kind: 'text', required: true },
            { key: 'value', label: 'Value', kind: 'text' },
        ]

        return (
            <div className="kb-artifact-form">
                {/* Type selector */}
                <TypeSelector
                    types={types}
                    selectedId={selectedType}
                    onChange={handleTypeChange}
                    onCreateNew={() => setCreatingType(true)}
                />

                {creatingType && (
                    <CustomTypeCreator
                        onAdd={addCustomType}
                        onCancel={() => setCreatingType(false)}
                    />
                )}

                {/* Type-specific fields */}
                <div className="kb-artifact-form-fields">
                    {fields.map(field => (
                        <div key={field.key} className="kb-artifact-form-field">
                            <label className="kb-artifact-form-field-label">
                                {field.label}{field.required && <span className="kb-artifact-required">*</span>}
                            </label>
                            {field.kind === 'file-browser' ? (
                                <FileBrowserField
                                    field={field}
                                    value={formData[field.key] || ''}
                                    onChange={v => handleFieldChange(field.key, v)}
                                    basePath={projectRoot}
                                />
                            ) : (
                                <FieldInput
                                    field={field}
                                    value={formData[field.key] || ''}
                                    onChange={v => handleFieldChange(field.key, v)}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="kb-artifact-form-actions">
                    <button className="kb-artifact-form-btn kb-artifact-form-btn--save" onClick={onSubmit}>{submitLabel}</button>
                    <button className="kb-artifact-form-btn" onClick={() => { setAdding(false); setEditingId(null); setFormData({}); setCreatingType(false) }}>Cancel</button>
                </div>
            </div>
        )
    }

    /* ─── Render artifact display ────────────────────────────────── */

    const renderArtifactDisplay = (artifact, viewMode) => {
        const type = getTypeById(types, artifact.type)
        const data = artifact.data || {}
        const linkUrl = data.url || artifact.url || artifact.href

        // Build data fields list for comfortable/expanded
        const fields = Object.entries(data)
            .filter(([k, v]) => k !== 'name' && v && typeof v === 'string')

        const subtitle = fields.map(([, v]) => v).join(' · ')

        return (
            <div className={`kb-artifact kb-artifact--${viewMode}`}>
                {/* ── Row 1: always icon + title ── */}
                <div className="kb-artifact-header" onClick={() => cycleView(artifact.id)}>
                    <span className="kb-artifact-icon">{type?.icon || artifact.icon || '📎'}</span>
                    <div className="kb-artifact-name">{artifact.name || data.name}</div>
                    {viewMode === 'compact' && artifact.type && (
                        <span className="kb-artifact-type-badge">{type?.label || artifact.type}</span>
                    )}
                    <span className="kb-artifact-view-indicator" title={`View: ${viewMode}`}>
                        {viewMode === 'compact' ? '▸' : viewMode === 'comfortable' ? '▾' : '▴'}
                    </span>
                </div>

                {/* ── Comfortable: type badge + one-line subtitle ── */}
                {viewMode !== 'compact' && (
                    <div className="kb-artifact-comfortable">
                        {artifact.type && (
                            <span className="kb-artifact-type-badge">{type?.label || artifact.type}</span>
                        )}
                        {subtitle && <div className="kb-artifact-preview">{subtitle}</div>}
                        {linkUrl && (
                            <a className="kb-artifact-link" href={linkUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                {linkUrl.length > 50 ? linkUrl.slice(0, 50) + '…' : linkUrl} ↗
                            </a>
                        )}
                    </div>
                )}

                {/* ── Expanded: all fields + metadata ── */}
                {viewMode === 'expanded' && (
                    <div className="kb-artifact-expanded">
                        {fields.map(([key, val]) => (
                            <div key={key} className="kb-artifact-expanded-field">
                                <span className="kb-artifact-expanded-label">{key}</span>
                                <span className="kb-artifact-expanded-value">{val}</span>
                            </div>
                        ))}
                        {(data.path || artifact.path) && (
                            <div className="kb-artifact-expanded-field">
                                <span className="kb-artifact-expanded-label">path</span>
                                <span className="kb-artifact-expanded-value kb-artifact-path">{data.path || artifact.path}</span>
                            </div>
                        )}
                        {artifact.createdAt && (
                            <div className="kb-artifact-expanded-field">
                                <span className="kb-artifact-expanded-label">created</span>
                                <span className="kb-artifact-expanded-value">{new Date(artifact.createdAt).toLocaleString()}</span>
                            </div>
                        )}
                        {type?.description && (
                            <div className="kb-artifact-expanded-meta">{type.description}</div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="kb-artifacts-list">
            {items.map(artifact => {
                if (editingId === artifact.id) {
                    return <div key={artifact.id}>{renderForm(handleEditSave, 'Save')}</div>
                }

                const mode = getViewMode(artifact.id)
                return (
                    <div key={artifact.id} className={`kb-artifact-row kb-artifact-row--${mode}`}>
                        <div className="kb-artifact-actions">
                            <button className="kb-artifact-action-btn" onClick={() => handleEditStart(artifact)} title="Edit">✏️</button>
                            <button className="kb-artifact-action-btn kb-artifact-action-btn--delete" onClick={() => handleDelete(artifact.id)} title="Delete">✕</button>
                        </div>
                        {renderArtifactDisplay(artifact, mode)}
                    </div>
                )
            })}

            {adding ? renderForm(handleAdd, 'Add') : (
                <button className="kb-artifact-add-btn" onClick={() => { setAdding(true); setFormData(emptyData(getTypeById(types, 'file'))); setSelectedType('file') }}>
                    + Add artifact
                </button>
            )}
        </div>
    )
}
