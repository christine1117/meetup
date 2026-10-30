/* ---------- Routing ---------- */




export function parseRoute() {
  const [name = 'explore', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'explore', id };
}
export const go = (path) => { location.hash = '#/' + path; };
export const viewing = (tid) => { const r = parseRoute(); return r.name === 'chats' && r.id === tid; };
