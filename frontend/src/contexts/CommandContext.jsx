import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const CommandContext = createContext(null)

/**
 * CommandProvider — Global command registry for the app-wide command palette.
 *
 * Pages register/unregister their own commands via useRegisterCommands().
 * Base commands (navigation, theme) are always available.
 */
export function CommandProvider({ children, theme, toggleTheme }) {
    // Commands map: source → command[]
    const [commandSources, setCommandSources] = useState({})
    const [isOpen, setIsOpen] = useState(false)

    // Register commands from a source (page, global, etc.)
    const registerCommands = useCallback((sourceId, commands) => {
        setCommandSources(prev => ({ ...prev, [sourceId]: commands }))
    }, [])

    // Unregister commands from a source
    const unregisterCommands = useCallback((sourceId) => {
        setCommandSources(prev => {
            const next = { ...prev }
            delete next[sourceId]
            return next
        })
    }, [])

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen(o => !o), [])

    // All commands flattened — base commands always first, then page-specific
    const allCommands = Object.values(commandSources).flat()

    // Global ⌘K listener
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                toggle()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [toggle, isOpen])

    // Register always-available base commands (no navigation — sub-apps are separate)
    useEffect(() => {
        const baseCommands = [
            {
                id: 'cmd:toggle-theme',
                type: 'action',
                icon: theme === 'dark' ? '☀️' : '🌙',
                label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
                subtitle: 'Toggle between light and dark themes',
                action: () => toggleTheme(),
            },
        ]

        registerCommands('__base__', baseCommands)
    }, [theme, toggleTheme, registerCommands])

    return (
        <CommandContext.Provider value={{
            allCommands,
            registerCommands,
            unregisterCommands,
            isOpen,
            open,
            close,
            toggle,
        }}>
            {children}
        </CommandContext.Provider>
    )
}

/**
 * Hook: useCommandPalette — access palette open/close state
 */
export function useCommandPalette() {
    const ctx = useContext(CommandContext)
    if (!ctx) throw new Error('useCommandPalette must be used within CommandProvider')
    return ctx
}

/**
 * Hook: useRegisterCommands — register page-specific commands on mount
 *
 * @param {string} sourceId - unique ID for this command source
 * @param {Array} commands - array of command objects
 * @param {Array} deps - dependency array (re-register when these change)
 */
export function useRegisterCommands(sourceId, commands, deps = []) {
    const { registerCommands, unregisterCommands } = useCommandPalette()

    useEffect(() => {
        registerCommands(sourceId, commands)
        return () => unregisterCommands(sourceId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceId, registerCommands, unregisterCommands, ...deps])
}
