// ── Lightweight Markdown → HTML renderer ──
// Handles: headings, bold, italic, code, code blocks, lists, task lists, tables, links, line breaks

export function renderMarkdown(md) {
    if (!md) return ''

    let html = md

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre class="kb-md-codeblock"><code>${escapeHtml(code.trim())}</code></pre>`
    })

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="kb-md-code">$1</code>')

    // Tables
    html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, sep, body) => {
        const ths = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('')
        const rows = body.trim().split('\n').map(row => {
            const tds = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('')
            return `<tr>${tds}</tr>`
        }).join('')
        return `<table class="kb-md-table"><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`
    })

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Task lists
    html = html.replace(/^- \[x\] (.+)$/gm, '<div class="kb-md-task"><span class="kb-md-check kb-md-check--done">✓</span>$1</div>')
    html = html.replace(/^- \[ \] (.+)$/gm, '<div class="kb-md-task"><span class="kb-md-check">○</span>$1</div>')

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr/>')

    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>')

    // Single line breaks
    html = html.replace(/\n/g, '<br/>')

    return `<p>${html}</p>`
        .replace(/<p><\/p>/g, '')
        .replace(/<p>(<h[1-4]>)/g, '$1')
        .replace(/(<\/h[1-4]>)<\/p>/g, '$1')
        .replace(/<p>(<pre)/g, '$1')
        .replace(/(<\/pre>)<\/p>/g, '$1')
        .replace(/<p>(<table)/g, '$1')
        .replace(/(<\/table>)<\/p>/g, '$1')
        .replace(/<p>(<ul>)/g, '$1')
        .replace(/(<\/ul>)<\/p>/g, '$1')
        .replace(/<p>(<div class="kb-md-task")/g, '$1')
        .replace(/(<\/div>)<\/p>/g, '$1')
        .replace(/<p>(<hr\/>)/g, '$1')
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
