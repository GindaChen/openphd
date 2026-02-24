import { useState, useEffect, useRef } from 'react'

export default function CollapsibleSection({ title, icon, defaultOpen = true, children }) {
    const [open, setOpen] = useState(defaultOpen)
    const sectionRef = useRef(null)

    // Listen for palette-triggered section expansion
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.section === title) {
                setOpen(true)
                setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }
        }
        window.addEventListener('kb-expand-section', handler)
        return () => window.removeEventListener('kb-expand-section', handler)
    }, [title])

    if (!children) return null

    return (
        <div ref={sectionRef} className={`kb-detail-section kb-collapsible ${open ? 'kb-collapsible--open' : ''}`}>
            <h3
                className="kb-detail-section-title kb-collapsible-header"
                onClick={() => setOpen(!open)}
            >
                {icon && <span className="kb-collapsible-icon">{icon}</span>}
                <span>{title}</span>
            </h3>
            {open && (
                <div className="kb-collapsible-body">
                    {children}
                </div>
            )}
        </div>
    )
}
