import { useState, useEffect } from 'react'
import { MODELS_DEV_MAP, FALLBACK_MODELS } from './ai-providers.js'

const MODELS_DEV_URL = 'https://models.dev/api.json'
const CACHE_KEY = '__modelsDevCache'
const CACHE_TTL = 1000 * 60 * 30 // 30 minutes

/**
 * Custom hook that fetches model data from models.dev/api.json
 * and caches it in window + localStorage for reuse.
 *
 * Returns { data, loading, error, getModelsForProvider }
 */
export function useModelsDevData() {
    const [data, setData] = useState(() => window[CACHE_KEY] || null)
    const [loading, setLoading] = useState(!data)
    const [error, setError] = useState(null)

    useEffect(() => {
        // If already cached in window, skip fetch
        if (window[CACHE_KEY]) {
            setData(window[CACHE_KEY])
            setLoading(false)
            return
        }

        // Try localStorage cache
        try {
            const cached = localStorage.getItem(CACHE_KEY)
            if (cached) {
                const { ts, payload } = JSON.parse(cached)
                if (Date.now() - ts < CACHE_TTL) {
                    window[CACHE_KEY] = payload
                    setData(payload)
                    setLoading(false)
                    return
                }
            }
        } catch { /* ignore */ }

        // Fetch fresh
        setLoading(true)
        fetch(MODELS_DEV_URL)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                return r.json()
            })
            .then(payload => {
                window[CACHE_KEY] = payload
                setData(payload)
                setLoading(false)
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload }))
                } catch { /* quota exceeded, ok */ }
            })
            .catch(err => {
                setError(err.message)
                setLoading(false)
            })
    }, [])

    /**
     * Get filtered, sorted model list for a given provider.
     * Returns { models: Array, hasLive: boolean }
     */
    function getModelsForProvider(provider) {
        const devKey = MODELS_DEV_MAP[provider]
        if (data && devKey && data[devKey]?.models) {
            const models = Object.entries(data[devKey].models)
                .map(([id, m]) => ({ id, ...m }))
                .filter(m =>
                    m.modalities?.input?.includes('text') &&
                    m.modalities?.output?.includes('text')
                )
                .filter(m =>
                    !m.id.includes('embed') &&
                    !m.id.includes('whisper') &&
                    !m.family?.includes('embedding')
                )
                .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
            return { models, hasLive: true }
        }
        const fallback = (FALLBACK_MODELS[provider] || []).map(id => ({ id, name: id }))
        return { models: fallback, hasLive: false }
    }

    return { data, loading, error, getModelsForProvider }
}
