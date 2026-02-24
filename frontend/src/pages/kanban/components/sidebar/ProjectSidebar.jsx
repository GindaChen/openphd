import { useState, useRef, useEffect } from 'react'
import CreateProjectDialog from './CreateProjectDialog'
import AgentPulse from '../agents/AgentPulse'

export default function ProjectSidebar({ currentProject, onSelectProject, activeNav, onNavChange, onOpenSettings }) {
    const [projects, setProjects] = useState([
        { id: 'default', name: 'Research Board', emoji: '📐' },
        { id: 'whisper', name: 'Whisper ASR', emoji: '🎙️' },
    ])
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const dropdownRef = useRef(null)

    const activeProject = projects.find(p => p.id === currentProject) || projects[0]

    // Close dropdown on outside click
    useEffect(() => {
        if (!dropdownOpen) return
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [dropdownOpen])

    const handleAddProject = () => {
        setDropdownOpen(false)
        setCreateDialogOpen(true)
    }

    const handleProjectCreated = (project) => {
        setProjects(prev => [...prev, project])
        onSelectProject(project.id)
    }

    const handleDeleteProject = (e, id) => {
        e.stopPropagation()
        if (id === 'default') return
        if (!confirm('Delete this project?')) return
        setProjects(projects.filter(p => p.id !== id))
        if (currentProject === id) onSelectProject('default')
    }

    return (
        <div className="kb-sidebar">
            {/* ── Project Selector (icon-only, dropdown on click) ── */}
            <div className="kb-sidebar-selector-wrap" ref={dropdownRef}>
                <button
                    className="kb-sidebar-selector"
                    onClick={() => setDropdownOpen(o => !o)}
                    title={activeProject.name}
                >
                    <span className="kb-sidebar-selector-emoji">{activeProject.emoji}</span>
                </button>

                {dropdownOpen && (
                    <div className="kb-sidebar-dropdown">
                        <div className="kb-sidebar-dropdown-header">Projects</div>
                        {projects.map(proj => (
                            <button
                                key={proj.id}
                                className={`kb-sidebar-dropdown-item ${proj.id === currentProject ? 'kb-sidebar-dropdown-item--active' : ''}`}
                                onClick={() => { onSelectProject(proj.id); setDropdownOpen(false) }}
                            >
                                <span className="kb-sidebar-dropdown-emoji">{proj.emoji}</span>
                                <span className="kb-sidebar-dropdown-name">{proj.name}</span>
                                {proj.id === currentProject && <span className="kb-sidebar-dropdown-check">✓</span>}
                                {proj.id !== 'default' && (
                                    <button
                                        className="kb-sidebar-dropdown-delete"
                                        onClick={(e) => handleDeleteProject(e, proj.id)}
                                        title="Delete project"
                                    >×</button>
                                )}
                            </button>
                        ))}
                        <button className="kb-sidebar-dropdown-add" onClick={handleAddProject}>
                            <span>＋</span>
                            <span>Add project</span>
                        </button>
                    </div>
                )}
            </div>

            <div className="kb-sidebar-divider" />

            {/* ── Navigation Items (icon-only with CSS tooltips) ── */}
            <nav className="kb-sidebar-nav">
                <button
                    className={`kb-sidebar-nav-item ${activeNav === 'home' ? 'kb-sidebar-nav-item--active' : ''}`}
                    onClick={() => onNavChange('home')}
                    data-tooltip="Home"
                >
                    <span className="kb-sidebar-nav-icon">🏠</span>
                </button>
                <button
                    className={`kb-sidebar-nav-item ${activeNav === 'kanban' ? 'kb-sidebar-nav-item--active' : ''}`}
                    onClick={() => onNavChange('kanban')}
                    data-tooltip="Kanban Board"
                >
                    <span className="kb-sidebar-nav-icon">📋</span>
                </button>
                <button
                    className={`kb-sidebar-nav-item ${activeNav === 'agents' ? 'kb-sidebar-nav-item--active' : ''}`}
                    onClick={() => onNavChange('agents')}
                    data-tooltip="Agents"
                >
                    <span className="kb-sidebar-nav-icon">🤖</span>
                </button>
                <button
                    className={`kb-sidebar-nav-item ${activeNav === 'souls' ? 'kb-sidebar-nav-item--active' : ''}`}
                    onClick={() => onNavChange('souls')}
                    data-tooltip="Souls & Tools"
                >
                    <span className="kb-sidebar-nav-icon">🪶</span>
                </button>
            </nav>

            {/* ── Bottom ── */}
            <div className="kb-sidebar-bottom">
                <AgentPulse />
                <button
                    className="kb-sidebar-nav-item kb-sidebar-nav-item--subtle"
                    onClick={() => onOpenSettings?.()}
                    data-tooltip="Settings"
                >
                    <span className="kb-sidebar-nav-icon">⚙</span>
                </button>
            </div>

            {/* ── Create Project Dialog ── */}
            <CreateProjectDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onProjectCreated={handleProjectCreated}
            />
        </div>
    )
}
