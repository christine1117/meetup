/* Small helpers every module uses. No app logic here. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const uid = () => Math.random().toString(36).slice(2, 9);
export const later = (ms, fn) => setTimeout(fn, ms);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Only http(s) links are allowed into href attributes, so data from outside
// (crawled pages, user input) can never become a javascript: link.
export const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
