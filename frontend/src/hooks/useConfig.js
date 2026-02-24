import { useState, useEffect } from 'react'

/**
 * Manages all user configuration: endpoint, token, GPU, model, language, theme.
 * Persists each to localStorage and reads URL params for endpoint/token.
 */
export function useConfig() {
    const [endpoint, setEndpoint] = useState(() => {
        const params = new URLSearchParams(window.location.search)
        return params.get('endpoint') || localStorage.getItem('whisper_endpoint') || ''
    })
    const [token, setToken] = useState(() => {
        const params = new URLSearchParams(window.location.search)
        return params.get('token') || localStorage.getItem('whisper_token') || ''
    })
    const [gpuType, setGpuType] = useState(() => localStorage.getItem('whisper_gpu') || 'T4')
    const [modelSize, setModelSize] = useState(() => localStorage.getItem('whisper_model') || 'large-v3-turbo')
    const [language, setLanguage] = useState(() => localStorage.getItem('whisper_language') || 'auto')
    const [outputFormat, setOutputFormat] = useState(() => localStorage.getItem('whisper_format') || 'plain')
    const [preprocess, setPreprocess] = useState(() => localStorage.getItem('whisper_preprocess') === 'true')
    const [streaming, setStreaming] = useState(() => localStorage.getItem('whisper_streaming') === 'true')
    const [theme, setTheme] = useState(() => localStorage.getItem('whisper_theme') || 'light')
    const [backend, setBackend] = useState(() => localStorage.getItem('whisper_backend') || 'modal')
    const [deepinfraKey, setDeepinfraKey] = useState(() => localStorage.getItem('whisper_deepinfra_key') || '')
    const [deepinfraModel, setDeepinfraModel] = useState(() => localStorage.getItem('whisper_deepinfra_model') || 'openai/whisper-large-v3-turbo')

    // Persist all config to localStorage
    useEffect(() => { localStorage.setItem('whisper_endpoint', endpoint) }, [endpoint])
    useEffect(() => { localStorage.setItem('whisper_token', token) }, [token])
    useEffect(() => { localStorage.setItem('whisper_gpu', gpuType) }, [gpuType])
    useEffect(() => { localStorage.setItem('whisper_model', modelSize) }, [modelSize])
    useEffect(() => { localStorage.setItem('whisper_language', language) }, [language])
    useEffect(() => { localStorage.setItem('whisper_format', outputFormat) }, [outputFormat])
    useEffect(() => { localStorage.setItem('whisper_preprocess', String(preprocess)) }, [preprocess])
    useEffect(() => { localStorage.setItem('whisper_streaming', String(streaming)) }, [streaming])
    useEffect(() => { localStorage.setItem('whisper_backend', backend) }, [backend])
    useEffect(() => { localStorage.setItem('whisper_deepinfra_key', deepinfraKey) }, [deepinfraKey])
    useEffect(() => { localStorage.setItem('whisper_deepinfra_model', deepinfraModel) }, [deepinfraModel])
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('whisper_theme', theme)
    }, [theme])

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

    return {
        endpoint, setEndpoint,
        token, setToken,
        gpuType, setGpuType,
        modelSize, setModelSize,
        language, setLanguage,
        outputFormat, setOutputFormat,
        preprocess, setPreprocess,
        streaming, setStreaming,
        theme, toggleTheme,
        backend, setBackend,
        deepinfraKey, setDeepinfraKey,
        deepinfraModel, setDeepinfraModel,
    }
}
