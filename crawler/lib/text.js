/* Turning page HTML into plain, short text. */

const ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' };

export const clean = (s = '') => String(s)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(nbsp|amp|quot|#x27|#39|lt|gt);/g, (m) => ENTITIES[m])
  .replace(/\s+/g, ' ')
  .trim();

export const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

// The content of <meta name="..."> or <meta property="...">
export function meta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+(?:name|property|id)="${name}"[^>]+content="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

// The first JSON-LD block on a page, parsed, or null
export function jsonLd(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}
