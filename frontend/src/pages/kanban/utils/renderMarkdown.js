/**
 * renderMarkdown — lightweight markdown-to-HTML renderer (no deps).
 * Supports: fenced code blocks, inline code, bold, italic, links, unordered lists, line breaks.
 */
export function renderMarkdown(text) {
    if (!text) return ''
    let html = text
    // Fenced code blocks (```lang\n...\n```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="kb-ask-code-block"><code class="lang-${lang || 'text'}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    // Inline code
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>')
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    html = html.replace(/_(.+?)_/g, '<em>$1</em>')
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Unordered lists (lines starting with - or *)
    html = html.replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks (but not inside pre/code)
    html = html.replace(/\n/g, '<br/>')
    // Clean up extra br in pre blocks
    html = html.replace(/<pre([^>]*)>([\s\S]*?)<\/pre>/g, (m, attrs, inner) =>
        `<pre${attrs}>${inner.replace(/<br\/>/g, '\n')}</pre>`)
    return html
}
