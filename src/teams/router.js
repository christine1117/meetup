/* Routes: #/comps, #/comp/:id, #/chats, #/chat/:id, #/team/:id, #/me. */


export const go = (path) => { location.hash = '#/' + path; };
export function route() {
  const [name = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || 'comps', id };
}
