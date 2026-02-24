import process from 'node:process'
import { chmodSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import pathModule from 'node:path'
import pty from 'node-pty'
import { WebSocket, WebSocketServer } from 'ws'

const port = Number(process.env.TERMINAL_WS_PORT || 4001)
const wsPath = process.env.TERMINAL_WS_PATH || '/terminal/ws'
const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
const require = createRequire(import.meta.url)

const wss = new WebSocketServer({
    port,
    path: wsPath,
})

function decodeBase64(value) {
    return Buffer.from(value, 'base64').toString('utf8')
}

function encodeBase64(value) {
    return Buffer.from(value, 'utf8').toString('base64')
}

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
        return
    }

    socket.send(JSON.stringify(payload))
}

function ensureSpawnHelperIsExecutable() {
    try {
        const packageJsonPath = require.resolve('node-pty/package.json')
        const packageDir = pathModule.dirname(packageJsonPath)
        const helperCandidates = [
            pathModule.join(packageDir, 'build', 'Release', 'spawn-helper'),
            pathModule.join(packageDir, 'build', 'Debug', 'spawn-helper'),
            pathModule.join(packageDir, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper'),
        ]

        for (const helperPath of helperCandidates) {
            if (existsSync(helperPath)) {
                chmodSync(helperPath, 0o755)
            }
        }
    } catch (error) {
        console.warn(`[terminal] Failed to verify node-pty helper permissions: ${error.message}`)
    }
}

ensureSpawnHelperIsExecutable()

wss.on('connection', (socket) => {
    let term

    try {
        term = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.cwd(),
            env: process.env,
        })
    } catch (error) {
        sendJson(socket, {
            type: 'info',
            message: `PTY spawn failed: ${error.message}`,
        })
        socket.close()
        return
    }

    sendJson(socket, {
        type: 'info',
        message: `PTY started with ${shell}`,
    })

    term.onData((output) => {
        sendJson(socket, {
            type: 'output',
            data: encodeBase64(output),
        })
    })

    term.onExit(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.close()
        }
    })

    socket.on('message', (raw) => {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8')

        let payload

        try {
            payload = JSON.parse(text)
        } catch {
            payload = {
                type: 'input',
                data: encodeBase64(text),
            }
        }

        if (payload.type === 'input' && typeof payload.data === 'string') {
            term.write(decodeBase64(payload.data))
            return
        }

        if (payload.type === 'resize') {
            const cols = Number(payload.cols)
            const rows = Number(payload.rows)

            if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) {
                term.resize(cols, rows)
            }
        }
    })

    socket.on('close', () => {
        term.kill()
    })

    socket.on('error', () => {
        term.kill()
    })
})

console.log(`[terminal] WebSocket bridge ready at ws://127.0.0.1:${port}${wsPath}`)
