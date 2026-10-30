/* ---------- Simulated people responding to what you post ---------- */

import { later, pick } from '../shared/core.js?v=20261030f';
import { L } from '../shared/i18n.js?v=20261030f';
import { PEOPLE, openRoles } from './people.js?v=20261030f';
import { S, save } from './state.js?v=20261030f';
import { toast } from './ui.js?v=20261030f';
import { render } from './shell.js?v=20261030f';


export function scheduleIncoming(item, key) {
  item.seen = item.seen || (item.responses || item.comments || []).map((r) => r.pid || r.by);
  if (item.seen.length >= 2) return;
  later(4000 + Math.random() * 3000, () => {
    const list = key === 'thought' ? S.myThoughts : S.myPosts;
    if (!list.includes(item) || item.seen.length >= 2) return;
    if (key === 'post' && !openRoles(item).length) return;
    const pool = key === 'post' && item.sentTo ? PEOPLE.filter((x) => item.sentTo.includes(x.id)) : PEOPLE;
    const left = pool.filter((x) => !item.seen.includes(x.id));
    if (!left.length) return;
    const p = pick(left);
    item.seen.push(p.id);
    if (key === 'thought') (item.comments = item.comments || []).push({ by: p.id, text: p.take, at: Date.now() });
    else item.responses.push({ pid: p.id, text: p.pitch, role: pick(openRoles(item)).name });
    save();
    toast(key === 'thought' ? L`Someone commented on your post` : L`Someone applied to your post`);
    render();
    scheduleIncoming(item, key);
  });
}
