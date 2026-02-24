import { useState } from 'react'

/**
 * SyncDialog — modal that shows sync progress/log instead of a plain alert.
 *
 * Props:
 *   isOpen: bool
 *   direction: 'pull' | 'push'
 *   onClose: () => void
 *   onSync: (direction, addLog) => Promise<void>
 */
export default function SyncDialog({ isOpen, direction, onClose, onSync }) {
    const [logs, setLogs] = useState([])
    const [running, setRunning] = useState(false)
    const [done, setDone] = useState(false)

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { msg, type, ts: Date.now() }])
    }

    const handleStart = async () => {
        setLogs([])
        setDone(false)
        setRunning(true)
        addLog(`Starting ${direction}…`, 'info')
        try {
            await onSync(direction, addLog)
            setDone(true)
        } catch (err) {
            addLog(`❌ Error: ${err.message}`, 'error')
            setDone(true)
        } finally {
            setRunning(false)
        }
    }

    const handleClose = () => {
        if (running) return
        setLogs([])
        setDone(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="kb-settings-overlay" onClick={handleClose}>
            <div
                className="kb-settings-panel"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 520 }}
            >
                <div className="kb-settings-header">
                    <h2>{direction === 'pull' ? '⬇ Pull from GitHub' : '⬆ Push to GitHub'}</h2>
                    <button className="kb-settings-close" onClick={handleClose} disabled={running}>✕</button>
                </div>

                <div className="kb-settings-body" style={{ padding: '16px 20px' }}>
                    {logs.length === 0 && !running && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                {direction === 'pull'
                                    ? 'Pull issues from your GitHub repository into the local board.'
                                    : 'Push local issues to your GitHub repository.'}
                            </p>
                            <button
                                className="kb-settings-save"
                                onClick={handleStart}
                                style={{ fontSize: 14, padding: '10px 28px' }}
                            >
                                {direction === 'pull' ? '⬇ Start Pull' : '⬆ Start Push'}
                            </button>
                        </div>
                    )}

                    {logs.length > 0 && (
                        <div
                            className="sync-log"
                            style={{
                                background: 'var(--bg, #111)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md, 8px)',
                                padding: '12px 14px',
                                maxHeight: 320,
                                overflowY: 'auto',
                                fontFamily: 'monospace',
                                fontSize: 12,
                                lineHeight: 1.7,
                            }}
                        >
                            {logs.map((l, i) => (
                                <div
                                    key={i}
                                    style={{
                                        color: l.type === 'error' ? '#f87171'
                                            : l.type === 'success' ? '#4ade80'
                                                : l.type === 'warn' ? '#fbbf24'
                                                    : 'var(--text-secondary, #999)',
                                    }}
                                >
                                    {l.msg}
                                </div>
                            ))}
                            {running && (
                                <div style={{ color: 'var(--text-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }}>
                                    ⏳ Working…
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {done && (
                    <div className="kb-settings-footer">
                        <button className="kb-settings-save" onClick={handleClose}>
                            ✓ Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
