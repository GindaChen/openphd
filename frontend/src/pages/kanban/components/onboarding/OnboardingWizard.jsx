import { useState, useEffect } from 'react'
import { loadSettings, saveSettings } from '../../store/settings'
import { apiFetch } from '../../store/api'

const STEPS = [
    { id: 'welcome', title: 'Welcome', icon: '👋' },
    { id: 'project', title: 'Project', icon: '📁' },
    { id: 'connect', title: 'Connect', icon: '🔗' },
    { id: 'ready', title: 'Ready!', icon: '🚀' },
]

export default function OnboardingWizard({ onComplete }) {
    const [step, setStep] = useState(0)
    const [settings, setSettings] = useState(loadSettings)
    const [browsePath, setBrowsePath] = useState('')
    const [browseDirs, setBrowseDirs] = useState([])
    const [browseParent, setBrowseParent] = useState('')
    const [showBrowser, setShowBrowser] = useState(false)
    const [testingGh, setTestingGh] = useState(false)
    const [ghOk, setGhOk] = useState(null)
    const [testingAi, setTestingAi] = useState(false)
    const [aiOk, setAiOk] = useState(null)

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleBrowse = async (targetPath) => {
        try {
            const params = targetPath ? `?path=${encodeURIComponent(targetPath)}` : ''
            const res = await fetch(`/api/kanban/browse${params}`)
            const data = await res.json()
            if (res.ok) {
                setBrowsePath(data.current)
                setBrowseParent(data.parent)
                setBrowseDirs(data.dirs)
            }
        } catch { /* ignore */ }
    }

    useEffect(() => {
        if (showBrowser && !browsePath) handleBrowse(settings.projectRoot || '')
    }, [showBrowser])

    const testGithub = async () => {
        if (!settings.githubToken || !settings.githubRepo) return
        setTestingGh(true)
        try {
            // Save temporarily so the API can use the token
            saveSettings(settings)
            const status = await apiFetch('/sync/status')
            setGhOk(status.configured)
        } catch {
            setGhOk(false)
        }
        setTestingGh(false)
    }

    const testAi = async () => {
        if (!settings.llmApiKey) return
        setTestingAi(true)
        try {
            saveSettings(settings)
            const status = await apiFetch('/agents/status')
            setAiOk(!!status.configured || !!settings.llmApiKey)
        } catch {
            setAiOk(false)
        }
        setTestingAi(false)
    }

    const finish = () => {
        const final = { ...settings, onboardingDone: true }
        saveSettings(final)
        onComplete?.(final)
    }

    const next = () => {
        if (step < STEPS.length - 1) {
            // Save settings at each step
            saveSettings(settings)
            setStep(s => s + 1)
        } else {
            finish()
        }
    }

    const back = () => setStep(s => Math.max(0, s - 1))

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-wizard">
                {/* Progress bar */}
                <div className="onboarding-progress">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.id}
                            className={`onboarding-progress-step ${i <= step ? 'active' : ''} ${i === step ? 'current' : ''}`}
                        >
                            <div className="onboarding-progress-dot">
                                {i < step ? '✓' : s.icon}
                            </div>
                            <span className="onboarding-progress-label">{s.title}</span>
                        </div>
                    ))}
                    <div className="onboarding-progress-line">
                        <div className="onboarding-progress-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
                    </div>
                </div>

                {/* Content */}
                <div className="onboarding-content">
                    {step === 0 && (
                        <div className="onboarding-step">
                            <div className="onboarding-hero-icon">🧪</div>
                            <h1 className="onboarding-title">Welcome to OpenPHD</h1>
                            <p className="onboarding-subtitle">
                                Your AI-powered research command center. Track issues, run experiments,
                                and let agents work alongside you.
                            </p>
                            <div className="onboarding-features">
                                <div className="onboarding-feature">
                                    <span className="onboarding-feature-icon">📋</span>
                                    <div>
                                        <strong>Kanban Board</strong>
                                        <p>Track research issues with drag-and-drop</p>
                                    </div>
                                </div>
                                <div className="onboarding-feature">
                                    <span className="onboarding-feature-icon">🤖</span>
                                    <div>
                                        <strong>AI Agents</strong>
                                        <p>Background agents that research and execute tasks</p>
                                    </div>
                                </div>
                                <div className="onboarding-feature">
                                    <span className="onboarding-feature-icon">🔗</span>
                                    <div>
                                        <strong>GitHub Sync</strong>
                                        <p>Bidirectional sync with your GitHub issues</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="onboarding-step">
                            <h2 className="onboarding-step-title">📁 Choose Your Project</h2>
                            <p className="onboarding-subtitle">
                                Select a directory for your project data. Leave empty to use the server default.
                            </p>
                            <div className="onboarding-field">
                                <label>Project Root</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        className="onboarding-input"
                                        placeholder="Leave empty for default"
                                        value={settings.projectRoot}
                                        onChange={e => update('projectRoot', e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="onboarding-btn-secondary" onClick={() => setShowBrowser(o => !o)}>
                                        📂 Browse
                                    </button>
                                </div>
                            </div>
                            {showBrowser && (
                                <div className="onboarding-browser">
                                    <div className="onboarding-browser-path">{browsePath || '/'}</div>
                                    {browseParent && (
                                        <button className="onboarding-browser-item" onClick={() => handleBrowse(browseParent)}>
                                            📂 ..
                                        </button>
                                    )}
                                    {browseDirs.map(d => (
                                        <button key={d} className="onboarding-browser-item" onClick={() => handleBrowse(d)}>
                                            📁 {d.split('/').pop()}
                                        </button>
                                    ))}
                                    <button
                                        className="onboarding-btn-secondary"
                                        style={{ marginTop: 8, width: '100%' }}
                                        onClick={() => { update('projectRoot', browsePath); setShowBrowser(false) }}
                                    >
                                        ✓ Use this directory
                                    </button>
                                </div>
                            )}
                            <div className="onboarding-hint">
                                💡 A new project is auto-created if the directory doesn&apos;t exist yet.
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="onboarding-step">
                            <h2 className="onboarding-step-title">🔗 Connect Services</h2>
                            <p className="onboarding-subtitle">
                                Optional — you can skip this and configure later in Settings.
                            </p>

                            <div className="onboarding-connect-card">
                                <div className="onboarding-connect-header">
                                    <span>🐙 GitHub Integration</span>
                                    {ghOk === true && <span className="onboarding-badge-ok">✓ Connected</span>}
                                    {ghOk === false && <span className="onboarding-badge-err">✗ Failed</span>}
                                </div>
                                <div className="onboarding-field">
                                    <label>GitHub Token</label>
                                    <input
                                        className="onboarding-input"
                                        type="password"
                                        placeholder="ghp_... or github_pat_..."
                                        value={settings.githubToken}
                                        onChange={e => update('githubToken', e.target.value)}
                                    />
                                </div>
                                <div className="onboarding-field">
                                    <label>Repository</label>
                                    <input
                                        className="onboarding-input"
                                        placeholder="owner/repo"
                                        value={settings.githubRepo}
                                        onChange={e => update('githubRepo', e.target.value)}
                                    />
                                </div>
                                {settings.githubToken && settings.githubRepo && (
                                    <button className="onboarding-btn-secondary" onClick={testGithub} disabled={testingGh}>
                                        {testingGh ? '⏳ Testing...' : '🔌 Test Connection'}
                                    </button>
                                )}
                            </div>

                            <div className="onboarding-connect-card">
                                <div className="onboarding-connect-header">
                                    <span>🤖 AI Assistant</span>
                                    {aiOk === true && <span className="onboarding-badge-ok">✓ Ready</span>}
                                    {aiOk === false && <span className="onboarding-badge-err">✗ Failed</span>}
                                </div>
                                <div className="onboarding-field">
                                    <label>API Key</label>
                                    <input
                                        className="onboarding-input"
                                        type="password"
                                        placeholder="sk-... or anthropic key"
                                        value={settings.llmApiKey}
                                        onChange={e => update('llmApiKey', e.target.value)}
                                    />
                                </div>
                                <div className="onboarding-field-row">
                                    <div className="onboarding-field" style={{ flex: 1 }}>
                                        <label>Provider</label>
                                        <select
                                            className="onboarding-input"
                                            value={settings.llmProvider}
                                            onChange={e => update('llmProvider', e.target.value)}
                                        >
                                            <option value="anthropic">Anthropic</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="google">Google</option>
                                        </select>
                                    </div>
                                    <div className="onboarding-field" style={{ flex: 1 }}>
                                        <label>Model</label>
                                        <input
                                            className="onboarding-input"
                                            value={settings.llmModel}
                                            onChange={e => update('llmModel', e.target.value)}
                                        />
                                    </div>
                                </div>
                                {settings.llmApiKey && (
                                    <button className="onboarding-btn-secondary" onClick={testAi} disabled={testingAi}>
                                        {testingAi ? '⏳ Testing...' : '🔌 Test Connection'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="onboarding-step">
                            <div className="onboarding-hero-icon">🚀</div>
                            <h2 className="onboarding-title">You&apos;re All Set!</h2>
                            <p className="onboarding-subtitle">
                                Here&apos;s a summary of your setup and some quick tips.
                            </p>
                            <div className="onboarding-summary">
                                <div className={`onboarding-summary-item ${settings.projectRoot ? 'active' : ''}`}>
                                    <span>{settings.projectRoot ? '✅' : '🏠'}</span>
                                    <span>{settings.projectRoot ? `Project: ${settings.projectRoot.split('/').pop()}` : 'Default project root'}</span>
                                </div>
                                <div className={`onboarding-summary-item ${settings.githubToken ? 'active' : ''}`}>
                                    <span>{settings.githubToken ? '✅' : '⬜'}</span>
                                    <span>{settings.githubToken ? `GitHub: ${settings.githubRepo}` : 'GitHub: not connected'}</span>
                                </div>
                                <div className={`onboarding-summary-item ${settings.llmApiKey ? 'active' : ''}`}>
                                    <span>{settings.llmApiKey ? '✅' : '⬜'}</span>
                                    <span>{settings.llmApiKey ? `AI: ${settings.llmModel}` : 'AI: not connected'}</span>
                                </div>
                            </div>
                            <div className="onboarding-shortcuts">
                                <h3>⌨ Quick Shortcuts</h3>
                                <div className="onboarding-shortcut-row">
                                    <kbd>⌘K</kbd> <span>Command Palette — search everything</span>
                                </div>
                                <div className="onboarding-shortcut-row">
                                    <kbd>⌘J</kbd> <span>Toggle Home / Board view</span>
                                </div>
                                <div className="onboarding-shortcut-row">
                                    <kbd>⚙</kbd> <span>Settings — reconfigure anytime</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="onboarding-nav">
                    {step > 0 ? (
                        <button className="onboarding-btn-secondary" onClick={back}>← Back</button>
                    ) : <div />}
                    <div className="onboarding-nav-right">
                        {step < STEPS.length - 1 && step > 0 && (
                            <button className="onboarding-btn-skip" onClick={next}>Skip →</button>
                        )}
                        <button className="onboarding-btn-primary" onClick={next}>
                            {step === 0 ? "Let's Go →" : step === STEPS.length - 1 ? '🚀 Launch' : 'Next →'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
