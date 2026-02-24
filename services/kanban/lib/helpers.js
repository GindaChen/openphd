// ── Shared file I/O helpers ──
import fs from 'fs'

export function readJSON(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
}

export function writeJSON(filepath, data) {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export function readMD(filepath) {
    try { return fs.readFileSync(filepath, 'utf-8') }
    catch { return '' }
}

export function writeMD(filepath, content) {
    fs.writeFileSync(filepath, content, 'utf-8')
}
