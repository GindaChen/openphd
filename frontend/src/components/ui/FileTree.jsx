/**
 * FileTree — standalone directory browser component
 *
 * Inspired by Magic UI file-tree (https://magicui.design/docs/components/file-tree)
 * but implemented with vanilla CSS (no Tailwind / shadcn dependency).
 *
 * Usage:
 *   <FileTree
 *     currentPath="/home/user/project"
 *     dirs={['src', 'public', 'tests']}
 *     parentPath="/home/user"
 *     error={null}
 *     onNavigate={(path) => fetchDirs(path)}
 *     onSelect={(path) => setProjectRoot(path)}
 *   />
 */

import './FileTree.css'

export default function FileTree({
    currentPath = '',
    dirs = [],
    parentPath = '',
    error = null,
    onNavigate,
    onSelect,
}) {
    const showParent = currentPath && currentPath !== parentPath

    return (
        <div className="file-tree">
            {/* ── Header: current path + select button ── */}
            <div className="file-tree__header">
                <span className="file-tree__path">
                    {currentPath || 'Loading…'}
                </span>
                <button
                    type="button"
                    className="file-tree__select-btn"
                    onClick={() => onSelect?.(currentPath)}
                >
                    ✓ Select
                </button>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="file-tree__error">
                    <span>⚠</span>
                    <span>{error}</span>
                </div>
            )}

            {/* ── Directory list ── */}
            <div className="file-tree__list">
                {/* Parent (..) entry */}
                {showParent && (
                    <button
                        type="button"
                        className="file-tree__item file-tree__item--parent"
                        onClick={() => onNavigate?.(parentPath)}
                    >
                        <span className="file-tree__icon">⬆</span>
                        <span>..</span>
                    </button>
                )}

                {/* Subdirectory entries */}
                {dirs.map((dir) => (
                    <button
                        key={dir}
                        type="button"
                        className="file-tree__item"
                        onClick={() => onNavigate?.(currentPath + '/' + dir)}
                    >
                        <span className="file-tree__icon">📁</span>
                        <span>{dir}</span>
                    </button>
                ))}

                {/* Empty state */}
                {dirs.length === 0 && !error && (
                    <div className="file-tree__empty">No subdirectories</div>
                )}
            </div>
        </div>
    )
}
