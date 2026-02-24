import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook for drag-to-resize a panel.
 *
 * Two modes:
 *   1. Pixel mode (default): min/max in pixels.
 *   2. Percentage mode: set `percentBased: true` and provide a `containerRef`.
 *      minPercent/maxPercent (0–100) constrain the width as a fraction of the
 *      container's offsetWidth.
 *
 * Returns: { width, handleMouseDown }
 *   — `width` is always a pixel number (you apply it via style={{ width }}).
 */
export function useResizable({
    initialWidth = 520,
    minWidth = 360,
    maxWidth = 900,
    storageKey = null,
    // Percentage mode
    percentBased = false,
    containerRef = null,
    minPercent = 2,
    maxPercent = 98,
    initialPercent = 50,
    // Direction: false = left-edge drag (detail panel), true = right-edge drag (dashboard)
    reverse = false,
}) {
    const [width, setWidth] = useState(() => {
        if (storageKey) {
            const saved = localStorage.getItem(storageKey)
            if (saved) {
                const val = parseInt(saved)
                if (!isNaN(val)) return val
            }
        }
        if (percentBased && containerRef?.current) {
            return Math.round(containerRef.current.offsetWidth * (initialPercent / 100))
        }
        return initialWidth
    })

    const dragging = useRef(false)
    const startX = useRef(0)
    const startWidth = useRef(width)

    // Recalculate width from stored percentage when container mounts/resizes
    useEffect(() => {
        if (!percentBased || !containerRef?.current) return

        const recalc = () => {
            if (dragging.current) return
            const cw = containerRef.current?.offsetWidth
            if (!cw) return

            if (storageKey) {
                const savedPct = localStorage.getItem(storageKey)
                if (savedPct) {
                    const pct = parseFloat(savedPct)
                    if (!isNaN(pct)) {
                        setWidth(Math.round(cw * (pct / 100)))
                        return
                    }
                }
            }
            setWidth(Math.round(cw * (initialPercent / 100)))
        }

        recalc()

        const ro = new ResizeObserver(recalc)
        ro.observe(containerRef.current)
        return () => ro.disconnect()
    }, [percentBased, containerRef, initialPercent, storageKey])

    const clamp = useCallback((val) => {
        if (percentBased && containerRef?.current) {
            const cw = containerRef.current.offsetWidth
            const lo = Math.round(cw * (minPercent / 100))
            const hi = Math.round(cw * (maxPercent / 100))
            return Math.max(lo, Math.min(hi, val))
        }
        return Math.max(minWidth, Math.min(maxWidth, val))
    }, [percentBased, containerRef, minPercent, maxPercent, minWidth, maxWidth])

    const handleMouseDown = useCallback((e) => {
        e.preventDefault()
        dragging.current = true
        startX.current = e.clientX
        startWidth.current = width
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [width])

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragging.current) return
            // reverse=false: left-edge drag (detail panel) — moving left = wider
            // reverse=true:  right-edge drag (dashboard) — moving right = wider
            const delta = reverse
                ? (e.clientX - startX.current)
                : (startX.current - e.clientX)
            const newWidth = clamp(startWidth.current + delta)
            setWidth(newWidth)
        }

        const handleMouseUp = () => {
            if (!dragging.current) return
            dragging.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            if (storageKey) {
                if (percentBased && containerRef?.current) {
                    const cw = containerRef.current.offsetWidth
                    const pct = (width / cw * 100).toFixed(1)
                    localStorage.setItem(storageKey, pct)
                } else {
                    localStorage.setItem(storageKey, width.toString())
                }
            }
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [width, clamp, storageKey, percentBased, containerRef])

    return { width, handleMouseDown }
}
