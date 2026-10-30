/* Observability: every caught error goes through here.
   Today it writes to the browser console and keeps the last 20 in
   window.halfSugarErrors, so they can be read while debugging. When there is
   a server, this is the one place that would also send them to a log service. */

const recent = [];

export function logError(where, err) {
  const entry = { where, message: String((err && err.message) || err), at: new Date().toISOString() };
  recent.push(entry);
  if (recent.length > 20) recent.shift();
  console.error(`[${where}]`, err);
  return entry;
}

if (typeof window !== 'undefined') {
  window.halfSugarErrors = recent;
  window.addEventListener('error', (e) => logError('page', e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => logError('promise', e.reason));
}
