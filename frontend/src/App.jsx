import { useState, useCallback } from 'react'
import KanbanPage from './pages/kanban/KanbanPage'
import { CommandProvider } from './contexts/CommandContext'

export default function App() {
    const [theme, setTheme] = useState(() =>
        localStorage.getItem('kb-theme') || 'dark'
    )

    const toggleTheme = useCallback(() => {
        setTheme(t => {
            const next = t === 'dark' ? 'light' : 'dark'
            localStorage.setItem('kb-theme', next)
            document.documentElement.setAttribute('data-theme', next)
            return next
        })
    }, [])

    return (
        <CommandProvider theme={theme} toggleTheme={toggleTheme}>
            <KanbanPage />
        </CommandProvider>
    )
}
