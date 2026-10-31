/* Chats: sending, half sugar notes, teaming up and ending politely.
   reply() plays the other side until there is a server. */
import { L } from '../shared/i18n.js?v=20261031u';

import { later, pick, uid } from '../shared/core.js?v=20261031u';
import { REVEAL_AT, sugarOf } from '../shared/sugar.js?v=20261031u';
import { S, U, save } from './state.js?v=20261031u';
import { toast } from './ui.js?v=20261031u';
import { LINES, MATE_LINES, P } from './sample-people.js?v=20261031u';
import { go } from './router.js?v=20261031u';
import { defaultMax, isFull, isGroup, myRoles, myTeam, needsOf, sideTeam, teamMax, teamsIn, voters } from './rules.js?v=20261031u';
import { render } from './render.js?v=20261031u';

export const chatById = (id) => S.chats.find((c) => c.id === id);
export const chatName = (c) => (c.kind === 'team' ? teamsIn(c.comp).find((t) => t.id === c.ref).name : (c.revealed ? P[c.ref].real.name : P[c.ref].alias));

export function push(c, from, text, who) {
  const before = sugarOf(c);
  c.msgs.push({ from, text, who, at: Date.now() });
  c.at = Date.now();
  if (before < REVEAL_AT && sugarOf(c) >= REVEAL_AT && !c.teamed) {
    c.msgs.push({ from: 'sys', text: 'Half sugar! You can team up now.', at: Date.now() });
  }
  save();
}

export function reply(c, delay = 1500) {
  U.typing[c.id] = true;
  render();
  later(delay, () => {
    U.typing[c.id] = false;
    if (!chatById(c.id)) return;
    if (c.status !== 'open') return;
    // In a group chat a different person may answer; your own teammates ask the newcomer questions
    const others = voters(c).filter((v) => v !== 'me');
    const who = c.kind === 'team' ? pick(others) : c.li % 3 === 2 && others.length > 1 ? pick(others.filter((v) => v !== c.ref)) : c.ref;
    const mate = c.kind === 'person' && who !== c.ref;
    push(c, 'them', mate ? pick(MATE_LINES) : LINES[c.li % LINES.length], who);
    c.li += 1;
    save();
    render();
  });
}

export function startChat(cid, kind, ref, text) {
  const c = { id: uid(), comp: cid, kind, ref, msgs: [], li: 0, at: Date.now(), status: 'open', votes: {}, teamed: false, revealed: false };
  if (kind === 'person' && myTeam(cid) && myTeam(cid).members.length > 1) {
    c.msgs.push({ from: 'sys', text: 'Your whole team is in this chat. Everyone uses nicknames until you team up.', at: Date.now() });
  } else if (kind === 'team') {
    c.msgs.push({ from: 'sys', text: 'Everyone on the team is in this chat. Everyone uses nicknames until you team up.', at: Date.now() });
  }
  S.chats.push(c);
  push(c, 'me', text);
  go('chat/' + c.id);
  reply(c, 1800);
}

// How big the team would be after this chat ends in a team up
export const sizeAfter = (c) => voters(c).length;
export const tooBig = (c) => sizeAfter(c) > (sideTeam(c) ? teamMax(sideTeam(c)) : defaultMax(c.comp));

// End a chat for a reason nobody has to explain
export function endChat(c, text, mine = true) {
  if (text) c.msgs.push({ from: mine ? 'me' : 'sys', text, at: Date.now() });
  c.msgs.push({ from: 'sys', text: 'Chat ended.', at: Date.now() });
  c.status = 'closed';
}

// Everyone said yes: reveal names and make (or grow) a team
export function formTeam(c) {
  const cid = c.comp;
  let team;
  let fresh = false;
  const newcomer = c.kind === 'team' ? 'me' : c.ref;
  if (c.kind === 'team') {
    team = S.teams.find((t) => t.id === c.ref) || JSON.parse(JSON.stringify(teamsIn(cid).find((t) => t.id === c.ref)));
    if (!S.teams.includes(team)) S.teams.push(team);
    team.members.push('me');
  } else {
    team = myTeam(cid);
    if (team) team.members.push(c.ref);
    else {
      team = { id: uid(), comp: cid, name: `${S.me.alias} & ${P[c.ref].alias}`, pitch: '', members: ['me', c.ref], needs: [], max: defaultMax(cid), msgs: [], code: uid() };
      fresh = true;
      S.teams.push(team);
    }
  }
  // A role the team asked for is now taken
  const got = newcomer === 'me' ? myRoles(cid) : P[newcomer].canDo;
  team.needs = needsOf(team).filter((r) => !got.includes(r));
  team.msgs = team.msgs || [];
  team.code = team.code || uid();
  const name = newcomer === 'me' ? L`${S.me.name || S.me.alias} (you)` : P[newcomer].real.name;
  team.msgs.push({ from: 'sys', text: fresh ? 'Team formed. Names are now visible to everyone in the team.' : '{0} joined the team after chatting to half sugar.', vars: fresh ? [] : [name], at: Date.now() });
  c.teamed = true;
  c.revealed = true;
  c.team = team.id;
  c.msgs.push({ from: 'sys', text: 'You teamed up! Names are unlocked.', at: Date.now() });

  // You can only be in one team per competition: end your chats with other teams politely
  S.chats.filter((x) => x !== c && x.comp === cid && x.status === 'open' && !x.teamed).forEach((x) => {
    if (x.kind === 'team') endChat(x, L`I just joined a team. Thanks for chatting, and good luck!`);
    else if (isFull(team)) endChat(x, 'The team is full now, so this chat ended.', false);
    else if (isGroup(x)) x.msgs.push({ from: 'sys', text: 'You are in a team now, so your teammates are in this chat too.', at: Date.now() });
  });
  save();
  toast(L`You teamed up!`);
  go('team/' + team.id);
}
