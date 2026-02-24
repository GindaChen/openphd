import React, { useState, useCallback } from 'react'
import { PROVIDER_PRESETS, PROVIDER_INFO, PROVIDER_OPTIONS } from './ai-providers.js'
import { useModelsDevData } from './useModelsDevData.js'

/**
 * AI Assistant settings section — extracted from SettingsPanel
 * to keep the main panel lean.
 *
 * Props:
 *   settings    – current settings object
 *   update      – (key, value) => void
 */
export default function AISettingsSection({ settings, update }) {
    const [showApiKey, setShowApiKey] = useState(false)
    const [copied, setCopied] = useState(false)
    const [connStatus, setConnStatus] = useState(null) // null | 'testing' | 'ok' | 'error'
    const [connMsg, setConnMsg] = useState('')

    const { getModelsForProvider, loading: modelsLoading } = useModelsDevData()

    const provider = settings.llmProvider || 'anthropic'
    const info = PROVIDER_INFO[provider] || PROVIDER_INFO.custom
    const { models: modelOptions, hasLive } = getModelsForProvider(provider)

    // ── Provider change ──
    const handleProviderChange = useCallback((e) => {
        const next = e.target.value
        const preset = PROVIDER_PRESETS[next]
        update('llmProvider', next)
        if (preset) {
            update('llmBaseUrl', preset.baseUrl)
            update('llmModel', preset.model)
        }
        setShowApiKey(false)
    }, [update])

    // ── Copy API key ──
    const handleCopy = useCallback(() => {
        if (settings.llmApiKey) {
            navigator.clipboard.writeText(settings.llmApiKey)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }
    }, [settings.llmApiKey])

    // ── Test connection ──
    const handleTestConnection = useCallback(async () => {
        setConnStatus('testing')
        setConnMsg('')
        try {
            const baseUrl = (settings.llmBaseUrl || '').replace(/\/$/, '')
            const key = settings.llmApiKey || ''
            if (!baseUrl) throw new Error('No base URL configured')

            let res
            if (provider === 'anthropic') {
                res = await fetch(baseUrl + '/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model: settings.llmModel || 'claude-sonnet-4-6',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'hi' }],
                    }),
                })
                if (res.ok) {
                    setConnStatus('ok')
                    setConnMsg('Connected to Anthropic ✓')
                } else {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error?.message || `HTTP ${res.status}`)
                }
            } else if (provider === 'ollama') {
                res = await fetch(baseUrl.replace('/v1', '') + '/api/tags')
                if (res.ok) {
                    const data = await res.json()
                    setConnStatus('ok')
                    setConnMsg(`Connected to Ollama (${data.models?.length || 0} models) ✓`)
                } else {
                    throw new Error(`HTTP ${res.status}`)
                }
            } else {
                const headers = {}
                if (key) headers['Authorization'] = `Bearer ${key}`
                res = await fetch(baseUrl + '/models', { headers })
                if (res.ok) {
                    const data = await res.json()
                    setConnStatus('ok')
                    setConnMsg(`Connected (${data.data?.length || data.length || 0} models available) ✓`)
                } else {
                    const err = await res.json().catch(() => ({}))
                    throw new Error(err.error?.message || `HTTP ${res.status}`)
                }
            }
            setTimeout(() => setConnStatus(null), 8000)
        } catch (err) {
            setConnStatus('error')
            setConnMsg(err.message)
        }
    }, [provider, settings.llmBaseUrl, settings.llmApiKey, settings.llmModel])

    // ── Model list helpers ──
    const modelIds = modelOptions.map(m => m.id)
    const isModelInList = modelIds.includes(settings.llmModel)

    return (
        <>
            <h3 className="ai-section-heading">🤖 AI Assistant</h3>
            <p className="kb-settings-hint">
                Select your AI provider and paste your API key. Models are loaded live
                from{' '}
                <a href="https://models.dev" target="_blank" rel="noopener noreferrer"
                    className="ai-provider-link">models.dev</a>.
            </p>

            {/* ── Provider ── */}
            <label className="kb-settings-label">
                Provider
                <select className="kb-settings-input" value={provider} onChange={handleProviderChange}>
                    {PROVIDER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                {info.doc && (
                    <div className="ai-provider-meta">
                        <a href={info.doc} target="_blank" rel="noopener noreferrer"
                            className="ai-provider-link">
                            🔑 Get key from {info.label} ↗
                        </a>
                        {info.env && <code className="ai-env-badge">{info.env}</code>}
                    </div>
                )}
            </label>

            {/* ── API Key ── */}
            <label className="kb-settings-label">
                API Key{' '}
                {provider === 'ollama' && (
                    <span className="kb-settings-hint" style={{ display: 'inline', marginLeft: 6 }}>
                        (optional for local)
                    </span>
                )}
                <div className="ai-key-row">
                    <input
                        className="kb-settings-input"
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={info.placeholder}
                        value={settings.llmApiKey}
                        onChange={e => update('llmApiKey', e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button type="button" className="ai-icon-btn"
                        onClick={() => setShowApiKey(v => !v)}
                        title={showApiKey ? 'Hide key' : 'Show key'}>
                        {showApiKey ? '🙈' : '👁'}
                    </button>
                    <button type="button"
                        className={`ai-icon-btn ${copied ? 'ai-icon-btn--copied' : ''}`}
                        onClick={handleCopy} title="Copy to clipboard">
                        {copied ? '✓' : '📋'}
                    </button>
                </div>
            </label>

            {/* ── Model ── */}
            <label className="kb-settings-label">
                Model
                <select
                    className="kb-settings-input"
                    value={isModelInList ? settings.llmModel : '__custom__'}
                    onChange={e => { if (e.target.value !== '__custom__') update('llmModel', e.target.value) }}
                >
                    {hasLive ? (
                        modelOptions.map(m => {
                            const cost = m.cost ? ` · $${m.cost.input}/$${m.cost.output}` : ''
                            const ctx = m.limit?.context
                                ? ` · ${(m.limit.context / 1000).toFixed(0)}K`
                                : ''
                            const badges = [
                                m.reasoning && '🧠',
                                m.tool_call && '🔧',
                                m.open_weights && '🔓',
                            ].filter(Boolean).join('')
                            return (
                                <option key={m.id} value={m.id}>
                                    {m.name || m.id}{ctx}{cost} {badges}
                                </option>
                            )
                        })
                    ) : (
                        modelOptions.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)
                    )}
                    <option value="__custom__">Custom…</option>
                </select>
                {!isModelInList && (
                    <input
                        className="kb-settings-input ai-custom-input"
                        placeholder="Enter custom model identifier"
                        value={settings.llmModel}
                        onChange={e => update('llmModel', e.target.value)}
                    />
                )}
                {!hasLive && provider !== 'custom' && modelsLoading && (
                    <span className="kb-settings-hint ai-loading-hint">
                        ⏳ Loading live models from models.dev…
                    </span>
                )}
            </label>

            {/* ── Base URL (Custom only) ── */}
            {provider === 'custom' && (
                <label className="kb-settings-label">
                    Base URL
                    <input
                        className="kb-settings-input"
                        placeholder="https://api.openai.com/v1"
                        value={settings.llmBaseUrl}
                        onChange={e => update('llmBaseUrl', e.target.value)}
                    />
                    <span className="kb-settings-hint ai-loading-hint">
                        Enter your OpenAI-compatible API base URL.
                    </span>
                </label>
            )}

            {/* ── Test Connection ── */}
            <div className="ai-conn-card">
                <div className="ai-conn-header">
                    <div>
                        <div className="ai-conn-title">🔌 Test Connection</div>
                        <p className="kb-settings-hint" style={{ margin: '2px 0 0' }}>
                            Verify your API key and endpoint are working.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn ai-conn-btn"
                        disabled={connStatus === 'testing'}
                        onClick={handleTestConnection}
                    >
                        {connStatus === 'testing' ? '⏳ Testing…'
                            : connStatus === 'ok' ? '✅ Connected'
                                : connStatus === 'error' ? '❌ Failed'
                                    : '🔌 Test'}
                    </button>
                </div>
                {connMsg && (
                    <p className={`ai-conn-msg ${connStatus === 'error' ? 'ai-conn-msg--error'
                            : connStatus === 'ok' ? 'ai-conn-msg--ok' : ''
                        }`}>{connMsg}</p>
                )}
            </div>
        </>
    )
}
