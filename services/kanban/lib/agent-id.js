// ── Agent ID Generator ──
// Produces human-readable IDs: YYYY-MM-DD-HH-MM-SS-adjective-noun
// ~3,600 combos from 60 adjectives × 60 nouns — enough for uniqueness within a project.

const ADJECTIVES = [
    'bold', 'brave', 'calm', 'cool', 'dark', 'dawn', 'deep', 'fast', 'gold', 'keen',
    'kind', 'late', 'lean', 'live', 'long', 'loud', 'main', 'mild', 'neat', 'open',
    'pale', 'pure', 'rare', 'real', 'rich', 'safe', 'slim', 'soft', 'sure', 'tall',
    'thin', 'true', 'vast', 'warm', 'wide', 'wild', 'wise', 'able', 'arch', 'awry',
    'bare', 'blue', 'busy', 'deft', 'dual', 'fair', 'fine', 'firm', 'flat', 'free',
    'full', 'glad', 'good', 'gray', 'half', 'hard', 'high', 'iron', 'just', 'next',
]

const NOUNS = [
    'arch', 'bark', 'bell', 'bolt', 'cape', 'cave', 'claw', 'coin', 'crow', 'dawn',
    'deer', 'dock', 'dove', 'drum', 'dusk', 'edge', 'fawn', 'fern', 'fire', 'flax',
    'fork', 'fox', 'gate', 'gale', 'glen', 'glow', 'gull', 'hare', 'hawk', 'helm',
    'hill', 'hive', 'iris', 'jade', 'kite', 'lake', 'lark', 'leaf', 'lime', 'lynx',
    'mare', 'mesa', 'mint', 'moon', 'moth', 'muse', 'nest', 'node', 'opal', 'owl',
    'palm', 'peak', 'pine', 'plum', 'pond', 'reef', 'sage', 'star', 'thorn', 'wolf',
]

/**
 * Generate a human-readable agent ID.
 * Format: YYYY-MM-DD-HH-MM-SS-adjective-noun
 * Example: 2026-02-24-11-35-21-brave-fox
 *
 * @param {Date} [now] — optional timestamp override (for testing)
 * @returns {string}
 */
export function generateAgentId(now = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    const ts = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
    ].join('-')

    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]

    return `${ts}-${adj}-${noun}`
}

/**
 * Parse a human-readable agent ID into its components.
 * @param {string} id
 * @returns {{ timestamp: string, adjective: string, noun: string, displayName: string }}
 */
export function parseAgentId(id) {
    const parts = id.split('-')
    // YYYY-MM-DD-HH-MM-SS = 6 parts, then adj, noun
    if (parts.length < 8) return null
    const noun = parts.pop()
    const adjective = parts.pop()
    const timestamp = parts.join('-')
    return {
        timestamp,
        adjective,
        noun,
        displayName: `${adjective}-${noun}`,
    }
}
