import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = process.env.KANBAN_PORT || 3001

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api/kanban': {
                target: `http://localhost:${API_PORT}`,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/kanban/, '/kanban'),
            },
            '/agents': {
                target: `http://localhost:${API_PORT}`,
                changeOrigin: true,
            },
        },
    },
})
