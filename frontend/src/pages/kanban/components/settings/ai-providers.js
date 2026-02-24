/**
 * AI Provider configuration constants.
 * Single source of truth for provider presets, fallback models,
 * documentation links, and models.dev mapping.
 */

export const PROVIDER_PRESETS = {
    anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-6' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-pro' },
    deepinfra: { baseUrl: 'https://api.deepinfra.com/v1/openai', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
}

export const PROVIDER_INFO = {
    anthropic: { doc: 'https://console.anthropic.com/settings/keys', env: 'ANTHROPIC_API_KEY', label: 'Anthropic Console', placeholder: 'sk-ant-...' },
    openai: { doc: 'https://platform.openai.com/api-keys', env: 'OPENAI_API_KEY', label: 'OpenAI Platform', placeholder: 'sk-...' },
    google: { doc: 'https://aistudio.google.com/apikey', env: 'GOOGLE_GENERATIVE_AI_API_KEY', label: 'Google AI Studio', placeholder: 'AIza...' },
    deepinfra: { doc: 'https://deepinfra.com/dash/api_keys', env: 'DEEPINFRA_API_KEY', label: 'DeepInfra', placeholder: 'API key' },
    ollama: { doc: null, env: null, label: 'Ollama (Local)', placeholder: 'Not required' },
    custom: { doc: null, env: null, label: 'Custom', placeholder: 'API key' },
}

// Map our provider IDs → models.dev provider keys
export const MODELS_DEV_MAP = {
    anthropic: 'anthropic',
    openai: 'openai',
    google: 'google',
    deepinfra: 'deepinfra',
    ollama: 'ollama-cloud',
}

// Static fallback when models.dev hasn't loaded yet
export const FALLBACK_MODELS = {
    anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
    openai: ['gpt-4o', 'gpt-5', 'gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o-mini'],
    google: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3-flash-preview', 'gemini-3-pro-preview'],
    deepinfra: [
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'Qwen/Qwen3-30B-A3B',
        'deepseek-ai/DeepSeek-V3',
        'mistralai/Mixtral-8x7B-Instruct-v0.1',
        'microsoft/phi-4-multimodal-instruct',
    ],
    ollama: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'phi3'],
}

export const PROVIDER_OPTIONS = [
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'google', label: 'Google (Gemini)' },
    { value: 'deepinfra', label: 'DeepInfra' },
    { value: 'ollama', label: 'Ollama (Local)' },
    { value: 'custom', label: 'Custom Endpoint' },
]
