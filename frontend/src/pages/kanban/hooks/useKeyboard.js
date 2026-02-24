import { useEffect, useCallback } from 'react'
import { loadSettings } from '../store/settings'

/**
 * Keyboard shortcuts for the kanban board.
 * Uses arrow keys by default (configurable via Settings panel).
 *
 * ↓ — move focus down between cards in the same column
 * ↑ — move focus up between cards in the same column
 * ← — move focus to the previous column (same row index)
 * → — move focus to the next column (same row index)
 * Enter — open focused card detail
 * Esc — close detail panel
 */
export function useKeyboard({ selectedIssue, onCloseDetail, onSelectIssue }) {
    const handleKeyDown = useCallback((e) => {
        // Don't fire if typing in an input/textarea
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
        // Don't fire if settings overlay is open
        if (document.querySelector('.kb-settings-overlay')) return

        const settings = loadSettings()
        const sc = settings.shortcuts
        const key = e.key

        // Get all columns and their cards
        const columnEls = Array.from(document.querySelectorAll('.kb-column'))
        const columns = columnEls.map(col => ({
            el: col,
            id: col.dataset.columnId,
            cards: Array.from(col.querySelectorAll('.kb-card')),
        }))

        const focusedCard = document.querySelector('.kb-card--focused')

        // Find which column and index the focused card is in
        let currentColIdx = -1
        let currentCardIdx = -1
        if (focusedCard) {
            for (let ci = 0; ci < columns.length; ci++) {
                const idx = columns[ci].cards.indexOf(focusedCard)
                if (idx >= 0) {
                    currentColIdx = ci
                    currentCardIdx = idx
                    break
                }
            }
        }

        const clearFocus = () => {
            document.querySelectorAll('.kb-card--focused').forEach(c =>
                c.classList.remove('kb-card--focused')
            )
        }

        const setFocus = (colIdx, cardIdx) => {
            clearFocus()
            const col = columns[colIdx]
            if (!col || col.cards.length === 0) return
            const clamped = Math.max(0, Math.min(cardIdx, col.cards.length - 1))
            const card = col.cards[clamped]
            card.classList.add('kb-card--focused')
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }

        // Arrow navigation
        if (key === 'ArrowDown') {
            e.preventDefault()
            if (currentColIdx < 0) {
                // No focus yet — focus first card in first non-empty column
                const firstCol = columns.findIndex(c => c.cards.length > 0)
                if (firstCol >= 0) setFocus(firstCol, 0)
            } else {
                // Move down in same column
                const nextIdx = Math.min(currentCardIdx + 1, columns[currentColIdx].cards.length - 1)
                setFocus(currentColIdx, nextIdx)
            }
            return
        }

        if (key === 'ArrowUp') {
            e.preventDefault()
            if (currentColIdx < 0) {
                const firstCol = columns.findIndex(c => c.cards.length > 0)
                if (firstCol >= 0) setFocus(firstCol, 0)
            } else {
                const prevIdx = Math.max(currentCardIdx - 1, 0)
                setFocus(currentColIdx, prevIdx)
            }
            return
        }

        if (key === 'ArrowRight') {
            e.preventDefault()
            if (currentColIdx < 0) {
                const firstCol = columns.findIndex(c => c.cards.length > 0)
                if (firstCol >= 0) setFocus(firstCol, 0)
            } else {
                // Move to next column with cards (skip empty)
                for (let i = currentColIdx + 1; i < columns.length; i++) {
                    if (columns[i].cards.length > 0) {
                        setFocus(i, currentCardIdx)
                        break
                    }
                }
            }
            return
        }

        if (key === 'ArrowLeft') {
            e.preventDefault()
            if (currentColIdx < 0) {
                const firstCol = columns.findIndex(c => c.cards.length > 0)
                if (firstCol >= 0) setFocus(firstCol, 0)
            } else {
                // Move to previous column with cards (skip empty)
                for (let i = currentColIdx - 1; i >= 0; i--) {
                    if (columns[i].cards.length > 0) {
                        setFocus(i, currentCardIdx)
                        break
                    }
                }
            }
            return
        }

        if (key === sc.openIssue) {
            if (focusedCard) {
                e.preventDefault()
                focusedCard.click()
            }
        } else if (key === sc.closePanel) {
            if (selectedIssue) {
                e.preventDefault()
                onCloseDetail()
            }
        }
    }, [selectedIssue, onCloseDetail, onSelectIssue])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
