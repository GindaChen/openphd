/**
 * Priority configuration — loads from priorities.json and provides
 * structured access for all kanban components.
 *
 * To customize priorities, edit config/priorities.json.
 * In the future, this can be loaded from GitHub labels or user settings.
 */
import config from '../config/priorities.json'

/** Ordered list of priority IDs */
export const PRIORITIES = config.priorities.map(p => p.id)

/** Default priority for new issues or issues with no priority set */
export const DEFAULT_PRIORITY = config.defaultPriority || 'none'

/** Style lookup: { [id]: { color, icon, label } } */
export const PRIORITY_STYLES = Object.fromEntries(
    config.priorities.map(p => [p.id, { color: p.color, icon: p.icon, label: p.label }])
)

/** Sort order lookup: { [id]: number } */
export const PRIORITY_ORDER = Object.fromEntries(
    config.priorities.map(p => [p.id, p.order])
)

/** Get style for a priority, falling back to the 'none' style */
export function getPriorityStyle(priority) {
    return PRIORITY_STYLES[priority] || PRIORITY_STYLES[DEFAULT_PRIORITY] || PRIORITY_STYLES.none
}
