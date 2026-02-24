// ── Issue CRUD routes ──
import fs from 'fs'
import path from 'path'
import { readJSON, writeJSON, writeMD } from '../lib/helpers.js'
import { getDataDir, getIssuesDir, ensureBootstrapped, loadIssue, loadAllIssues, getNextId, DEFAULT_DATA_DIR } from '../lib/project.js'

export default function issueRoutes(app) {
    // GET /kanban/config — current data directory info
    app.get('/kanban/config', (req, res) => {
        const dataDir = getDataDir(req)
        ensureBootstrapped(dataDir)
        res.json({
            dataDir,
            isDefault: dataDir === DEFAULT_DATA_DIR,
            defaultDataDir: DEFAULT_DATA_DIR,
        })
    })

    // ── Widget API (AI-writable, dynamic dashboard) ──
    const DEFAULT_WIDGETS = [
        { id: 'goals', title: 'Project Goals', icon: '🎯', type: 'list', items: [] },
        { id: 'top-items', title: 'Top Items', icon: '📌', type: 'issues', items: [] },
        { id: 'cluster', title: 'Cluster Pulse', icon: '⚡', type: 'cluster', data: { gpus: 0, busy: 0, utilization: 0, queued: 0 } },
        { id: 'jobs', title: 'Running Jobs', icon: '🔄', type: 'jobs', items: [] },
        { id: 'alerts', title: 'Active Alerts', icon: '⚠️', type: 'alerts', items: [] },
        { id: 'conclusions', title: 'Key Findings', icon: '💡', type: 'list', items: [] },
    ]

    function loadWidgets(dataDir) {
        const file = path.join(dataDir, 'widgets.json')
        if (!fs.existsSync(file)) {
            writeJSON(file, DEFAULT_WIDGETS)
            return DEFAULT_WIDGETS
        }
        return readJSON(file)
    }

    // GET /kanban/widgets — load dashboard widgets
    app.get('/kanban/widgets', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            res.json(loadWidgets(dataDir))
        } catch (err) {
            res.status(500).json({ error: 'Failed to read widgets', details: err.message })
        }
    })

    // PUT /kanban/widgets — replace all widgets (AI or user)
    app.put('/kanban/widgets', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const widgets = req.body
            if (!Array.isArray(widgets)) return res.status(400).json({ error: 'Body must be an array of widgets' })
            writeJSON(path.join(dataDir, 'widgets.json'), widgets)
            res.json(widgets)
        } catch (err) {
            res.status(500).json({ error: 'Failed to save widgets', details: err.message })
        }
    })

    // PATCH /kanban/widgets/:id — update a single widget by id
    app.patch('/kanban/widgets/:id', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const widgets = loadWidgets(dataDir)
            const idx = widgets.findIndex(w => w.id === req.params.id)
            if (idx < 0) {
                // Add as new widget
                widgets.push({ id: req.params.id, ...req.body })
            } else {
                widgets[idx] = { ...widgets[idx], ...req.body }
            }
            writeJSON(path.join(dataDir, 'widgets.json'), widgets)
            res.json(widgets[idx >= 0 ? idx : widgets.length - 1])
        } catch (err) {
            res.status(500).json({ error: 'Failed to update widget', details: err.message })
        }
    })

    // DELETE /kanban/widgets/:id — remove a widget
    app.delete('/kanban/widgets/:id', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            let widgets = loadWidgets(dataDir)
            widgets = widgets.filter(w => w.id !== req.params.id)
            writeJSON(path.join(dataDir, 'widgets.json'), widgets)
            res.json({ deleted: true, id: req.params.id })
        } catch (err) {
            res.status(500).json({ error: 'Failed to delete widget', details: err.message })
        }
    })

    // ── Widget Templates API (extensible by AI) ──
    //
    // Theory of Constraints (TOC) perspective:
    // A researcher's bottleneck shifts across phases:
    //   Exploration → Data → Experiment → Analysis → Writing → Deployment
    // Templates are organized by phase so the dashboard "evolves" with the
    // researcher by surfacing the current constraint. Add the phase-relevant
    // widgets when you enter that stage; archive or collapse the rest.
    //
    const DEFAULT_TEMPLATES = [
        // ══════════════════════════════════════
        //  CORE — Always useful
        // ══════════════════════════════════════
        {
            id: 'goals', label: 'Project Goals', icon: '🎯', category: 'core',
            template: {
                type: 'list', title: 'Project Goals', icon: '🎯', items: [
                    { text: 'Define your top 3 research goals here', status: 'planned' },
                ]
            }
        },
        {
            id: 'top-items', label: 'Top Items', icon: '📌', category: 'core',
            template: { type: 'issues', title: 'Top Items', icon: '📌', items: [] }
        },
        {
            id: 'quick-note', label: 'Quick Note', icon: '📄', category: 'core',
            template: { type: 'markdown', title: 'Quick Note', icon: '📄', content: 'Jot down your thoughts here...' }
        },
        {
            id: 'alerts', label: 'Active Alerts', icon: '⚠️', category: 'core',
            template: { type: 'alerts', title: 'Active Alerts', icon: '⚠️', items: [] }
        },
        {
            id: 'agents', label: 'Agent Fleet', icon: '🤖', category: 'core',
            template: { type: 'agents', title: 'Agent Fleet', icon: '🤖', items: [] }
        },
        {
            id: 'custom-json', label: 'Custom JSON', icon: '🔧', category: 'core',
            template: { type: 'custom', title: 'Custom Widget', icon: '🔧', data: {} }
        },

        // ══════════════════════════════════════
        //  EXPLORATION PHASE — Bottleneck: Knowledge & Direction
        //  "What should I work on? What has been tried?"
        // ══════════════════════════════════════
        {
            id: 'hypothesis-tracker', label: 'Hypothesis Tracker', icon: '🔬', category: 'exploration',
            template: {
                type: 'list', title: 'Hypothesis Tracker', icon: '🔬', items: [
                    { text: 'H1: [Your hypothesis]', status: 'planned' },
                    { text: 'H2: [Alternative hypothesis]', status: 'planned' },
                ]
            }
        },
        {
            id: 'reading-list', label: 'Reading List', icon: '📚', category: 'exploration',
            template: {
                type: 'list', title: 'Reading List', icon: '📚', items: [
                    { text: 'Paper: [Title] — [Key insight]', status: 'planned' },
                ]
            }
        },
        {
            id: 'decision-log', label: 'Decision Log', icon: '⚖️', category: 'exploration',
            template: {
                type: 'list', title: 'Decision Log', icon: '⚖️', items: [
                    { text: 'Decision: [What] — Reason: [Why] — Date: [When]', status: 'verified' },
                ]
            }
        },
        {
            id: 'research-questions', label: 'Research Questions', icon: '❓', category: 'exploration',
            template: {
                type: 'list', title: 'Research Questions', icon: '❓', items: [
                    { text: 'RQ1: [Main question driving this project]', status: 'in-progress' },
                ]
            }
        },
        {
            id: 'related-work', label: 'Related Work Map', icon: '🗺️', category: 'exploration',
            template: {
                type: 'markdown', title: 'Related Work Map', icon: '🗺️',
                content: '## Key Papers\n- **[Author et al., Year]** — [One-line summary]\n\n## Gaps\n- [What hasn\'t been explored]\n\n## Our Angle\n- [How we differ]'
            }
        },
        {
            id: 'assumptions', label: 'Assumptions Register', icon: '🧩', category: 'exploration',
            template: {
                type: 'list', title: 'Assumptions Register', icon: '🧩', items: [
                    { text: 'Assumption: [X is true] — Status: untested', status: 'warning' },
                ]
            }
        },

        // ══════════════════════════════════════
        //  DATA PHASE — Bottleneck: Data Quality & Availability
        //  "Do I have the right data? Is it clean?"
        // ══════════════════════════════════════
        {
            id: 'dataset-status', label: 'Dataset Status', icon: '🗄️', category: 'data',
            template: {
                type: 'kv', title: 'Dataset Status', icon: '🗄️', data: {
                    'Dataset': 'Not set', 'Samples': 0, 'Train/Val/Test': '—', 'Quality': '—', 'Last Updated': '—'
                }
            }
        },
        {
            id: 'data-pipeline', label: 'Data Pipeline', icon: '🔗', category: 'data',
            template: {
                type: 'list', title: 'Data Pipeline', icon: '🔗', items: [
                    { text: '1. Raw data collection', status: 'completed' },
                    { text: '2. Cleaning & dedup', status: 'in-progress' },
                    { text: '3. Feature engineering', status: 'planned' },
                    { text: '4. Train/val/test split', status: 'planned' },
                    { text: '5. Validation & QA', status: 'planned' },
                ]
            }
        },
        {
            id: 'annotation-tracker', label: 'Annotation Tracker', icon: '🏷️', category: 'data',
            template: {
                type: 'chart', title: 'Annotation Progress', icon: '🏷️', data: {
                    title: 'Labeled Samples',
                    labels: ['Batch 1', 'Batch 2', 'Batch 3', 'Batch 4'],
                    values: [
                        { value: 100, color: '#4ade80' },
                        { value: 75, color: '#4ade80' },
                        { value: 30, color: '#fbbf24' },
                        { value: 0, color: '#60a5fa' },
                    ],
                }
            }
        },
        {
            id: 'data-quality', label: 'Data Quality Check', icon: '✅', category: 'data',
            template: {
                type: 'list', title: 'Data Quality Check', icon: '✅', items: [
                    { text: 'No missing values in key columns', status: 'verified' },
                    { text: 'Class distribution is balanced', status: 'warning' },
                    { text: 'No data leakage between train/test', status: 'planned' },
                ]
            }
        },

        // ══════════════════════════════════════
        //  EXPERIMENT PHASE — Bottleneck: Compute & Iteration Speed
        //  "Which config works? Is training converging?"
        // ══════════════════════════════════════
        {
            id: 'experiment-log', label: 'Experiment Log', icon: '🧪', category: 'experiment',
            template: {
                type: 'runlog', title: 'Experiment Log', icon: '🧪', entries: [
                    { timestamp: 'Day 1', level: 'info', message: 'Baseline: lr=1e-4, batch=32, acc=0.82' },
                    { timestamp: 'Day 2', level: 'info', message: 'Exp-2: lr=3e-4, batch=64, acc=0.85 ↑' },
                ]
            }
        },
        {
            id: 'cluster-pulse', label: 'Cluster Pulse', icon: '⚡', category: 'experiment',
            template: {
                type: 'cluster', title: 'Cluster Pulse', icon: '⚡', data: {
                    gpus: 0, busy: 0, utilization: 0, queued: 0, running: 0
                }
            }
        },
        {
            id: 'running-jobs', label: 'Running Jobs', icon: '🔄', category: 'experiment',
            template: { type: 'jobs', title: 'Running Jobs', icon: '🔄', items: [] }
        },
        {
            id: 'hyperparams', label: 'Hyperparameter Grid', icon: '🎛️', category: 'experiment',
            template: {
                type: 'markdown', title: 'Hyperparameter Grid', icon: '🎛️',
                content: '| Param | Value | Status |\n|-------|-------|--------|\n| lr | 1e-4 | baseline |\n| batch | 32 | baseline |\n| epochs | 10 | baseline |\n| dropout | 0.1 | baseline |'
            }
        },
        {
            id: 'cost-tracker', label: 'Compute Cost', icon: '💰', category: 'experiment',
            template: {
                type: 'chart', title: 'Weekly Compute Cost', icon: '💰', data: {
                    title: 'USD / week',
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    values: [
                        { value: 0, color: '#667eea' }, { value: 0, color: '#667eea' },
                        { value: 0, color: '#667eea' }, { value: 0, color: '#667eea' },
                        { value: 0, color: '#667eea' }, { value: 0, color: '#4ade80' },
                        { value: 0, color: '#4ade80' },
                    ],
                }
            }
        },
        {
            id: 'wandb-embed', label: 'W&B Chart', icon: '📊', category: 'experiment',
            template: { type: 'wandb', title: 'W&B Chart', icon: '📊', embedUrl: '', height: 300 }
        },
        {
            id: 'ablation-matrix', label: 'Ablation Matrix', icon: '🧮', category: 'experiment',
            template: {
                type: 'markdown', title: 'Ablation Matrix', icon: '🧮',
                content: '## Ablation Study\n| Component | Removed | Accuracy | Δ |\n|-----------|---------|----------|---|\n| Module A | ✓ | 0.80 | -0.05 |\n| Module B | ✓ | 0.83 | -0.02 |\n| Both | ✓ | 0.76 | -0.09 |'
            }
        },

        // ══════════════════════════════════════
        //  ANALYSIS PHASE — Bottleneck: Interpretation & Insight
        //  "What do the results mean? Are they significant?"
        // ══════════════════════════════════════
        {
            id: 'metrics-dashboard', label: 'Metrics Dashboard', icon: '📈', category: 'analysis',
            template: {
                type: 'chart', title: 'Model Performance', icon: '📈', data: {
                    title: 'Metric Comparison',
                    labels: ['Accuracy', 'Precision', 'Recall', 'F1', 'AUC'],
                    values: [
                        { value: 0, color: '#667eea' }, { value: 0, color: '#4ade80' },
                        { value: 0, color: '#fbbf24' }, { value: 0, color: '#a78bfa' },
                        { value: 0, color: '#f87171' },
                    ],
                }
            }
        },
        {
            id: 'key-findings', label: 'Key Findings', icon: '💡', category: 'analysis',
            template: {
                type: 'list', title: 'Key Findings', icon: '💡', items: [
                    { text: 'Finding 1: [Describe the result and why it matters]', status: 'verified' },
                ]
            }
        },
        {
            id: 'error-analysis', label: 'Error Analysis', icon: '🔍', category: 'analysis',
            template: {
                type: 'list', title: 'Error Analysis', icon: '🔍', items: [
                    { text: 'Error pattern: [What kind of inputs fail]', status: 'critical' },
                    { text: 'Root cause: [Why it fails]', status: 'warning' },
                    { text: 'Mitigation: [What to try next]', status: 'planned' },
                ]
            }
        },
        {
            id: 'comparison-table', label: 'Baseline Comparison', icon: '⚔️', category: 'analysis',
            template: {
                type: 'markdown', title: 'Baseline Comparison', icon: '⚔️',
                content: '## Ours vs. Baselines\n| Method | Acc | F1 | Latency |\n|--------|-----|----|---------|\n| Baseline A | — | — | — |\n| Baseline B | — | — | — |\n| **Ours** | — | — | — |'
            }
        },
        {
            id: 'figure-gallery', label: 'Figure', icon: '🖼️', category: 'analysis',
            template: { type: 'figure', title: 'Figure', icon: '🖼️', src: '', caption: 'Add a figure URL' }
        },

        // ══════════════════════════════════════
        //  WRITING PHASE — Bottleneck: Articulation & Deadlines
        //  "Is the paper coherent? What's the narrative?"
        // ══════════════════════════════════════
        {
            id: 'paper-outline', label: 'Paper Outline', icon: '📝', category: 'writing',
            template: {
                type: 'list', title: 'Paper Outline', icon: '📝', items: [
                    { text: '1. Introduction — [hook + problem + contribution]', status: 'planned' },
                    { text: '2. Related Work — [positioning vs. prior art]', status: 'planned' },
                    { text: '3. Method — [architecture + training]', status: 'planned' },
                    { text: '4. Experiments — [setup + results + ablations]', status: 'planned' },
                    { text: '5. Discussion — [limitations + future work]', status: 'planned' },
                    { text: '6. Conclusion', status: 'planned' },
                ]
            }
        },
        {
            id: 'deadline-tracker', label: 'Deadline Tracker', icon: '⏰', category: 'writing',
            template: {
                type: 'list', title: 'Deadline Tracker', icon: '⏰', items: [
                    { text: 'Abstract due: [date]', status: 'planned' },
                    { text: 'Full paper due: [date]', status: 'planned' },
                    { text: 'Camera ready: [date]', status: 'planned' },
                ]
            }
        },
        {
            id: 'reviewer-feedback', label: 'Reviewer Feedback', icon: '👀', category: 'writing',
            template: {
                type: 'list', title: 'Reviewer Feedback', icon: '👀', items: [
                    { text: 'R1: [weakness] — Response: [how we address it]', status: 'warning' },
                ]
            }
        },
        {
            id: 'contribution-checklist', label: 'Contribution Checklist', icon: '✏️', category: 'writing',
            template: {
                type: 'list', title: 'Contribution Checklist', icon: '✏️', items: [
                    { text: 'Novel method/approach clearly described', status: 'planned' },
                    { text: 'Reproducibility: code + data available', status: 'planned' },
                    { text: 'Comprehensive evaluation vs. baselines', status: 'planned' },
                    { text: 'Clear limitations section', status: 'planned' },
                ]
            }
        },

        // ══════════════════════════════════════
        //  DEPLOYMENT — Bottleneck: Reliability & Scale
        //  "Does it work in production? Is it fast enough?"
        // ══════════════════════════════════════
        {
            id: 'deployment-checklist', label: 'Deployment Checklist', icon: '🚀', category: 'deployment',
            template: {
                type: 'list', title: 'Deployment Checklist', icon: '🚀', items: [
                    { text: 'Model exported to ONNX/TorchScript', status: 'planned' },
                    { text: 'API endpoint provisioned', status: 'planned' },
                    { text: 'Load test passed (< 100ms p99)', status: 'planned' },
                    { text: 'Monitoring & alerting configured', status: 'planned' },
                    { text: 'Rollback plan documented', status: 'planned' },
                ]
            }
        },
        {
            id: 'latency-budget', label: 'Latency Budget', icon: '⏱️', category: 'deployment',
            template: {
                type: 'kv', title: 'Latency Budget', icon: '⏱️', data: {
                    'Target p50': '< 50ms', 'Target p99': '< 200ms',
                    'Actual p50': '—', 'Actual p99': '—',
                    'Model Size': '—', 'Throughput': '—',
                }
            }
        },

        // ══════════════════════════════════════
        //  META / PRODUCTIVITY — Cross-cutting
        // ══════════════════════════════════════
        {
            id: 'risk-register', label: 'Risk Register', icon: '🛡️', category: 'meta',
            template: {
                type: 'list', title: 'Risk Register', icon: '🛡️', items: [
                    { text: 'Risk: [X] — Impact: High — Mitigation: [Y]', status: 'warning' },
                ]
            }
        },
        {
            id: 'standup-notes', label: 'Standup Notes', icon: '🗣️', category: 'meta',
            template: {
                type: 'markdown', title: 'Standup Notes', icon: '🗣️',
                content: '## Today\n**Done:** \n**Doing:** \n**Blocked:** \n\n## Tomorrow\n**Plan:** '
            }
        },
        {
            id: 'weekly-retro', label: 'Weekly Retro', icon: '🔄', category: 'meta',
            template: {
                type: 'markdown', title: 'Weekly Retro', icon: '🔄',
                content: '## Week of [date]\n**What worked:**\n- \n\n**What didn\'t:**\n- \n\n**What to try next:**\n- \n\n**Bottleneck this week:** [exploration | data | experiment | analysis | writing]'
            }
        },
        {
            id: 'collaborators', label: 'Collaborators', icon: '👥', category: 'meta',
            template: {
                type: 'list', title: 'Collaborators', icon: '👥', items: [
                    { text: 'Name — Role — Responsible for [X]', status: 'active' },
                ]
            }
        },
        {
            id: 'script-widget', label: 'Custom Script', icon: '⚙️', category: 'meta',
            template: { type: 'script', title: 'Custom Script', icon: '⚙️', template: '', script: '', html: '', height: 120 }
        },
        {
            id: 'html-widget', label: 'Custom HTML', icon: '🌐', category: 'meta',
            template: { type: 'html', title: 'Custom HTML', icon: '🌐', html: '<div style="color:#aaa;font-size:12px">Edit this widget to add custom HTML content</div>' }
        },
        {
            id: 'bottleneck-radar', label: 'Bottleneck Radar', icon: '🎯', category: 'meta',
            template: {
                type: 'chart', title: 'Where Am I Stuck?', icon: '🎯', data: {
                    title: 'Phase Bottleneck Score (higher = more stuck)',
                    labels: ['Exploration', 'Data', 'Experiment', 'Analysis', 'Writing', 'Deploy'],
                    values: [
                        { value: 0, color: '#667eea' }, { value: 0, color: '#4ade80' },
                        { value: 0, color: '#fbbf24' }, { value: 0, color: '#a78bfa' },
                        { value: 0, color: '#f87171' }, { value: 0, color: '#60a5fa' },
                    ],
                }
            }
        },
    ]

    function loadWidgetTemplates(dataDir) {
        const configDir = path.join(dataDir, 'config')
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
        const file = path.join(configDir, 'widget-templates.json')
        if (!fs.existsSync(file)) {
            writeJSON(file, DEFAULT_TEMPLATES)
            return DEFAULT_TEMPLATES
        }
        return readJSON(file)
    }

    // GET /kanban/widget-templates — list available widget templates
    app.get('/kanban/widget-templates', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            res.json(loadWidgetTemplates(dataDir))
        } catch (err) {
            res.status(500).json({ error: 'Failed to read widget templates', details: err.message })
        }
    })

    // PUT /kanban/widget-templates — replace templates (AI can add new types)
    app.put('/kanban/widget-templates', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const configDir = path.join(dataDir, 'config')
            if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
            if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array' })
            writeJSON(path.join(configDir, 'widget-templates.json'), req.body)
            res.json(req.body)
        } catch (err) {
            res.status(500).json({ error: 'Failed to save widget templates', details: err.message })
        }
    })

    // GET /kanban/widget-template-file — serve custom template HTML/JS from .agents/kanban/templates/
    app.get('/kanban/widget-template-file', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            const name = req.query.name
            if (!name) return res.status(400).json({ error: 'Missing name parameter' })
            // Sanitize: only allow alphanumeric, dash, underscore, dot
            const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '')
            const templatesDir = path.join(dataDir, 'templates')
            // Try .html, then .js, then exact name
            const candidates = [
                path.join(templatesDir, safeName),
                path.join(templatesDir, `${safeName}.html`),
                path.join(templatesDir, `${safeName}.js`),
            ]
            for (const candidate of candidates) {
                if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
                    const content = fs.readFileSync(candidate, 'utf-8')
                    return res.json({ html: content, name: safeName })
                }
            }
            res.status(404).json({ error: `Template "${safeName}" not found in ${templatesDir}` })
        } catch (err) {
            res.status(500).json({ error: 'Failed to read template', details: err.message })
        }
    })

    // GET /kanban/browse — list directories on the server for project root selection
    app.get('/kanban/browse', (req, res) => {
        try {
            const browsePath = req.query.path || DEFAULT_DATA_DIR
            if (!path.isAbsolute(browsePath)) {
                return res.status(400).json({ error: 'Path must be absolute' })
            }
            if (!fs.existsSync(browsePath)) {
                return res.status(404).json({ error: 'Path does not exist', path: browsePath })
            }
            const stat = fs.statSync(browsePath)
            if (!stat.isDirectory()) {
                return res.status(400).json({ error: 'Path is not a directory' })
            }
            const entries = fs.readdirSync(browsePath, { withFileTypes: true })
                .filter(e => e.isDirectory() && !e.name.startsWith('.'))
                .map(e => e.name)
                .sort()
            res.json({
                current: browsePath,
                parent: path.dirname(browsePath),
                dirs: entries,
            })
        } catch (err) {
            res.status(500).json({ error: 'Browse failed', details: err.message })
        }
    })

    // GET /kanban/check-dir — check directory status (exists, git, remote)
    app.get('/kanban/check-dir', async (req, res) => {
        try {
            const dirPath = req.query.path
            if (!dirPath) return res.status(400).json({ error: 'Missing path parameter' })
            if (!path.isAbsolute(dirPath)) return res.status(400).json({ error: 'Path must be absolute' })

            const exists = fs.existsSync(dirPath)
            let isGit = false
            let gitRemote = null

            if (exists) {
                // Check for .git directory
                isGit = fs.existsSync(path.join(dirPath, '.git'))
                if (isGit) {
                    try {
                        const { execSync } = await import('child_process')
                        gitRemote = execSync('git remote get-url origin', { cwd: dirPath, encoding: 'utf-8', timeout: 3000 }).trim()
                    } catch { /* no remote */ }
                }
            }

            res.json({ exists, isGit, gitRemote, hasAgents: exists && fs.existsSync(path.join(dirPath, '.agents')) })
        } catch (err) {
            res.status(500).json({ error: 'Check failed', details: err.message })
        }
    })

    // POST /kanban/init-project — initialize a new project
    app.post('/kanban/init-project', async (req, res) => {
        try {
            const { mode, path: dirPath, name } = req.body || {}
            const os = await import('os')
            let projectRoot

            if (mode === 'playground') {
                // Create under ~/.openphd/playgrounds/<name>
                const playgroundBase = path.join(os.default.homedir(), '.openphd', 'playgrounds')
                const safeName = (name || 'untitled').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
                projectRoot = path.join(playgroundBase, safeName)
            } else if (mode === 'directory') {
                if (!dirPath || !path.isAbsolute(dirPath)) {
                    return res.status(400).json({ error: 'Absolute path required' })
                }
                projectRoot = dirPath
            } else {
                return res.status(400).json({ error: 'Invalid mode. Use "directory" or "playground"' })
            }

            // Create directory + .agents scaffold
            const agentsDir = path.join(projectRoot, '.agents', 'kanban')
            if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true })

            // Bootstrap kanban data if not present
            ensureBootstrapped(path.join(projectRoot, '.agents', 'kanban'))

            // Check git status
            let isGit = fs.existsSync(path.join(projectRoot, '.git'))
            let gitRemote = null
            if (isGit) {
                try {
                    const { execSync } = await import('child_process')
                    gitRemote = execSync('git remote get-url origin', { cwd: projectRoot, encoding: 'utf-8', timeout: 3000 }).trim()
                } catch { /* no remote */ }
            }

            // Generate a project ID
            const projectId = `proj-${Date.now().toString(36)}`
            const projectName = name || path.basename(projectRoot)
            const emojis = ['📊', '🧬', '🔬', '🧠', '📡', '🛰️', '⚡', '🌐', '🎯', '🔮']
            const emoji = emojis[Math.floor(Math.random() * emojis.length)]

            res.json({
                projectId,
                name: projectName,
                emoji,
                root: projectRoot,
                isGit,
                gitRemote,
                mode,
            })
        } catch (err) {
            res.status(500).json({ error: 'Failed to initialize project', details: err.message })
        }
    })

    // GET /kanban/board — board layout config
    app.get('/kanban/board', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            ensureBootstrapped(dataDir)
            const board = readJSON(path.join(dataDir, 'board.json'))
            res.json(board)
        } catch (err) {
            res.status(500).json({ error: 'Failed to read board config', details: err.message })
        }
    })

    // GET /kanban/issues — all issues
    app.get('/kanban/issues', (req, res) => {
        try {
            const issues = loadAllIssues(req)
            res.json(issues)
        } catch (err) {
            res.status(500).json({ error: 'Failed to read issues', details: err.message })
        }
    })

    // GET /kanban/issues/:id — single issue
    app.get('/kanban/issues/:id', (req, res) => {
        try {
            const issue = loadIssue(req.params.id, req)
            if (!issue) return res.status(404).json({ error: 'Issue not found' })
            res.json(issue)
        } catch (err) {
            res.status(500).json({ error: 'Failed to read issue', details: err.message })
        }
    })

    // POST /kanban/issues — create issue
    app.post('/kanban/issues', (req, res) => {
        try {
            const issuesDir = getIssuesDir(req)
            ensureBootstrapped(getDataDir(req))
            const id = getNextId(req)
            const now = new Date().toISOString()
            const issue = {
                id,
                title: req.body.title || 'Untitled Issue',
                status: req.body.status || 'backlog',
                priority: req.body.priority || 'none',
                labels: req.body.labels || [],
                contextualInfo: req.body.contextualInfo || {},
                artifacts: [],
                relationships: [],
                chatMessages: [],
                createdAt: now,
                updatedAt: now,
            }
            const description = req.body.description || `# ${issue.title}\n\n(No description yet)\n`

            writeJSON(path.join(issuesDir, `${id}.json`), issue)
            writeMD(path.join(issuesDir, `${id}.md`), description)

            res.status(201).json({ ...issue, description })
        } catch (err) {
            res.status(500).json({ error: 'Failed to create issue', details: err.message })
        }
    })

    // PATCH /kanban/issues/:id — update issue metadata
    app.patch('/kanban/issues/:id', (req, res) => {
        try {
            const issuesDir = getIssuesDir(req)
            const jsonPath = path.join(issuesDir, `${req.params.id}.json`)
            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Issue not found' })

            const issue = readJSON(jsonPath)
            const updates = req.body

            const allowed = ['title', 'status', 'priority', 'labels', 'contextualInfo', 'artifacts', 'relationships', 'workspaces']
            for (const key of allowed) {
                if (updates[key] !== undefined) issue[key] = updates[key]
            }
            issue.updatedAt = new Date().toISOString()

            if (updates.description !== undefined) {
                writeMD(path.join(issuesDir, `${req.params.id}.md`), updates.description)
            }

            writeJSON(jsonPath, issue)
            res.json(loadIssue(req.params.id, req))
        } catch (err) {
            res.status(500).json({ error: 'Failed to update issue', details: err.message })
        }
    })

    // PATCH /kanban/issues/:id/move — move issue to new column
    app.patch('/kanban/issues/:id/move', (req, res) => {
        try {
            const issuesDir = getIssuesDir(req)
            const jsonPath = path.join(issuesDir, `${req.params.id}.json`)
            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Issue not found' })
            if (!req.body.status) return res.status(400).json({ error: 'Missing status field' })

            const issue = readJSON(jsonPath)
            issue.status = req.body.status
            issue.updatedAt = new Date().toISOString()
            writeJSON(jsonPath, issue)

            res.json(loadIssue(req.params.id, req))
        } catch (err) {
            res.status(500).json({ error: 'Failed to move issue', details: err.message })
        }
    })

    // POST /kanban/issues/:id/chat — add chat message
    app.post('/kanban/issues/:id/chat', (req, res) => {
        try {
            const issuesDir = getIssuesDir(req)
            const jsonPath = path.join(issuesDir, `${req.params.id}.json`)
            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Issue not found' })

            const issue = readJSON(jsonPath)
            issue.chatMessages.push({
                role: req.body.role || 'user',
                content: req.body.content,
                timestamp: new Date().toISOString(),
            })
            issue.updatedAt = new Date().toISOString()
            writeJSON(jsonPath, issue)

            res.json(loadIssue(req.params.id, req))
        } catch (err) {
            res.status(500).json({ error: 'Failed to add chat message', details: err.message })
        }
    })

    // DELETE /kanban/issues/:id — delete issue
    app.delete('/kanban/issues/:id', (req, res) => {
        try {
            const issuesDir = getIssuesDir(req)
            const jsonPath = path.join(issuesDir, `${req.params.id}.json`)
            const mdPath = path.join(issuesDir, `${req.params.id}.md`)
            if (!fs.existsSync(jsonPath)) return res.status(404).json({ error: 'Issue not found' })

            fs.unlinkSync(jsonPath)
            if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath)

            res.json({ deleted: true, id: parseInt(req.params.id) })
        } catch (err) {
            res.status(500).json({ error: 'Failed to delete issue', details: err.message })
        }
    })

    // DELETE /kanban/data/reset — wipe local issues (keep board config)
    // Allows fresh re-pull from GitHub as ground truth.
    app.delete('/kanban/data/reset', (req, res) => {
        try {
            const dataDir = getDataDir(req)
            const issuesDir = path.join(dataDir, 'issues')

            // Remove all issue files
            if (fs.existsSync(issuesDir)) {
                const files = fs.readdirSync(issuesDir)
                for (const file of files) {
                    fs.unlinkSync(path.join(issuesDir, file))
                }
            }

            // Reset .meta.json (nextId back to 1)
            const metaPath = path.join(dataDir, '.meta.json')
            writeJSON(metaPath, {
                nextId: 1,
                createdAt: new Date().toISOString(),
                lastSyncedAt: null,
            })

            // Re-bootstrap (recreate issues dir if needed)
            ensureBootstrapped(dataDir)

            res.json({ reset: true, message: 'All issues cleared. Board config preserved.' })
        } catch (err) {
            res.status(500).json({ error: 'Reset failed', details: err.message })
        }
    })
}
