/* ---------- Screen: Explore ---------- */

import { esc } from '../../shared/core.js?v=20261031a';
import { L } from '../../shared/i18n.js?v=20261031a';
import { flavorChip } from '../../shared/flavors.js?v=20261031a';
import { at, cupFor } from '../../shared/cup.js?v=20261031a';
import { field, select } from '../../shared/forms.js?v=20261031a';
import { CATEGORIES, P, SEED_THOUGHTS, catName } from '../people.js?v=20261031a';
import { TOP_PICKS, dayKey, topPicks } from '../matching.js?v=20261031a';
import { S, U } from '../state.js?v=20261031a';
import { parseRoute } from '../router.js?v=20261031a';
import { byline } from '../ui.js?v=20261031a';


export function responsesBlock(item, key) {
  if (!item.responses.length) {
    return (item.seen || []).length >= 2
      ? `<p class="waiting">${L`No more responses for now.`}</p>`
      : `<p class="waiting"><i class="ph ph-hourglass-medium" aria-hidden="true"></i>${L`Waiting for responses`}</p>`;
  }
  return `<ul class="responses">${item.responses.map((r) => `
    <li>
      ${byline(P[r.pid], true)}
      ${r.role ? `<p class="meta">${L`Applied as ${esc(r.role)}`}</p>` : ''}
      <p class="quote">${esc(r.text)}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="accept" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Accept, first sip`}</button>
        <button class="btn btn--ghost btn--sm" data-act="decline" data-key="${key}" data-id="${item.id}" data-pid="${r.pid}" type="button">${L`Skip`}</button>
      </div>
    </li>`).join('')}</ul>`;
}

/* ---------- Screen: Explore (a forum) ----------
   Posts sit in topics. Comments are public but anonymous, with no likes or
   follower counts, so nobody performs for an audience. Anyone can message a
   post's author or a commenter privately, which starts a normal chat. */

export const LOADED_AT = Date.now();
export const seedAt = (ago) => LOADED_AT - ago * 60000;

// Your posts and the seed posts in one shape, newest first
export function allPosts() {
  const mine = S.myThoughts.map((t) => ({ ...t, by: 'me', cat: t.cat || 'startups', at: t.at || LOADED_AT, comments: t.comments || [] }));
  const seeds = SEED_THOUGHTS.map((t) => ({ ...t, at: seedAt(t.ago), comments: t.comments.map((c) => ({ ...c, at: seedAt(c.ago) })) }));
  return [...mine, ...seeds].sort((a, b) => b.at - a.at);
}
export const postById = (id) => allPosts().find((p) => p.id === id);

// Comments that came with the post plus the ones written in this browser, oldest first
export const commentsOf = (post) => [...post.comments, ...((S.comments || {})[post.id] || [])].sort((a, b) => a.at - b.at);

export const authorName = (by) => (by === 'me' ? L`You` : P[by].alias);
export const authorLine = (by, full = false) => byline(by === 'me' ? { ...S.me, alias: L`You` } : P[by], full);

export function agoText(at) {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return L`just now`;
  if (m < 60) return L`${m}m ago`;
  if (m < 1440) return L`${Math.floor(m / 60)}h ago`;
  return L`${Math.floor(m / 1440)}d ago`;
}

// One line about who someone is, so you know who you are messaging
export const introLine = (p) => p.doing;

export const commentCount = (n) => (n === 1 ? L`1 comment` : L`${n} comments`);

// Message someone you met in Explore. `spot` says where the box opens, so only one shows at a time.
export function dmBox(pid, spot) {
  const existing = S.threads.find((t) => t.pid === pid);
  if (existing) return `<a class="btn btn--ghost btn--sm" href="#/chats/${existing.id}">${L`Open chat`}</a>`;
  if (U.dm && U.dm.pid === pid && U.dm.spot === spot) {
    return `
      <form class="stack reply" data-form="dm" data-pid="${pid}" data-post="${esc(spot.split(':')[0])}" novalidate>
        ${parseRoute().name === 'post' ? '' : `<div class="dm-who">${byline(P[pid], true)}</div>`}
        ${field('dm', L`Message ${esc(P[pid].alias)} privately`, '', { area: true, rows: 3, req: true, ph: L`Only they will see this. Your titles stay hidden.` })}
        <div class="btnrow">
          <button class="btn btn--dark btn--sm" type="submit">${L`Send`}</button>
          <button class="btn btn--ghost btn--sm" data-act="dm-close" type="button">${L`Cancel`}</button>
        </div>
      </form>`;
  }
  return `<button class="btn btn--ghost btn--sm" data-act="dm-open" data-pid="${pid}" data-spot="${esc(spot)}" type="button"><i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>${L`Message`}</button>`;
}

export function postCard(post) {
  return `
    <article class="card forum-post">
      <p class="forum-post__cat">${esc(catName(post.cat))}</p>
      <a class="thought forum-post__link" href="#/post/${post.id}">${esc(post.text)}</a>
      <div class="forum-post__foot">
        ${authorLine(post.by)}
        <a class="count-link" href="#/post/${post.id}" aria-label="${esc(commentCount(commentsOf(post).length))}"><i class="ph ph-chat-circle" aria-hidden="true"></i>${commentsOf(post).length}</a>
        <span class="meta">${agoText(post.at)}</span>
        ${post.by === 'me' ? '' : dmBox(post.by, post.id)}
      </div>
    </article>`;
}

export function viewExplore() {
  const cat = U.cat;
  const posts = allPosts();
  // Top picks: posts from the people who score highest with you today (All tab only)
  const top = cat === 'all'
    ? topPicks(SEED_THOUGHTS.map((t) => P[t.by]), TOP_PICKS, dayKey()).map((p) => posts.find((x) => x.by === p.id))
    : [];
  const list = posts.filter((p) => (cat === 'all' || p.cat === cat) && !top.includes(p));
  const tabs = [['all', L`All`], ...CATEGORIES.map(([v, l]) => [v, L(l)])];

  return `
  <header class="head">
    <div><h1 lang="en">${L`Explore`}</h1><p class="sub" lang="en">${L`I want to meet someone.`}</p></div>
    <button class="btn btn--primary" data-act="compose" data-what="thought" type="button"><i class="ph ph-plus" aria-hidden="true"></i>${L`New post`}</button>
  </header>

  ${U.compose === 'thought' ? `
  <form class="panel stack" data-form="thought" novalidate>
    ${select('cat', L`Topic`, CATEGORIES.map(([v, l]) => [v, L(l)]), cat === 'all' ? 'startups' : cat)}
    ${field('text', L`Your thought or question`, '', { area: true, rows: 3, req: true, ph: L`Something you have been turning over lately` })}
    <div class="brew-nudge" id="brew-nudge" hidden>
      <i class="ph ph-hammer" aria-hidden="true"></i>
      <p>${L`Looking for people to build with? Brew is made for that.`}</p>
      <div class="btnrow">
        <button class="btn btn--dark btn--sm" data-act="to-brew" type="button">${L`Move to Brew`}</button>
        <button class="btn btn--ghost btn--sm" data-act="nudge-off" type="button">${L`Keep it here`}</button>
      </div>
    </div>
    <div class="btnrow">
      <button class="btn btn--dark" type="submit">${L`Post`}</button>
      <button class="btn btn--ghost" data-act="compose" data-what="" type="button">${L`Cancel`}</button>
    </div>
  </form>` : ''}

  <div class="cats" role="group" aria-label="${esc(L`Topics`)}">
    ${tabs.map(([v, l]) => `<button class="cat ${cat === v ? 'is-on' : ''}" data-act="cat" data-value="${v}" type="button" aria-pressed="${cat === v}">${esc(l)}</button>`).join('')}
  </div>

  ${top.length ? `
  <section class="mine">
    <h2>${L`Top picks`}</h2>
    ${top.map(postCard).join('')}
  </section>` : ''}

  <section class="mine">
    <h2>${cat === 'all' ? (top.length ? L`Latest` : L`All posts`) : esc(catName(cat))}</h2>
    ${list.length ? list.map(postCard).join('') : `<p class="empty">${L`No posts in this topic yet. Start one.`}</p>`}
  </section>`;
}

// One post with its public comments
export function viewPost(id) {
  const post = postById(id);
  if (!post) return viewExplore();
  const comments = commentsOf(post);
  return `
  <a class="back-link" href="#/explore"><i class="ph ph-arrow-left" aria-hidden="true"></i>${L`Back to Explore`}</a>

  <article class="card forum-post forum-post--open">
    <p class="forum-post__cat">${esc(catName(post.cat))}</p>
    <p class="thought">${esc(post.text)}</p>
    ${authorLine(post.by, true)}
    <div class="forum-post__foot">
      <p class="meta">${agoText(post.at)}</p>
      ${post.by === 'me' ? '' : dmBox(post.by, post.id)}
    </div>
  </article>

  <section class="comments">
    <h2>${commentCount(comments.length)}</h2>
    <ul class="comments__list">
      ${comments.map((c) => `
      <li class="comment">
        <button class="avatar avatar--cup avatar-btn" data-act="profile" data-pid="${c.by}" type="button" tabindex="-1" aria-hidden="true">${cupFor(c.by === 'me' ? S.me : P[c.by])}</button>
        <div class="comment__body">
          <p class="comment__head">
            <button class="name-btn" data-act="profile" data-pid="${c.by}" type="button">${esc(authorName(c.by))}</button>
            ${c.by === 'me' ? '' : flavorChip(P[c.by])}
            ${c.by !== 'me' && c.by === post.by ? `<span class="tag">${L`Author`}</span>` : ''}
            <span class="meta">${agoText(c.at)}</span>
          </p>
          ${c.by === 'me' ? '' : `<p class="comment__intro">${esc(introLine(P[c.by]))}</p>`}
          <p>${esc(c.text)}</p>
          ${c.by === 'me' ? '' : `<div class="comment__actions">${dmBox(c.by, `${post.id}:${c.at}`)}</div>`}
        </div>
      </li>`).join('')}
      ${U.typingPost === post.id ? `<li class="comment"><span class="msg msg--them msg--typing" aria-label="${esc(L`Someone is typing`)}"><span></span><span></span><span></span></span></li>` : ''}
    </ul>
    <form class="comment-form" data-form="comment" data-id="${post.id}" novalidate>
      <label class="sr" for="c-comment">${L`Add a public comment`}</label>
      <textarea id="c-comment" name="comment" rows="2" placeholder="${esc(L`Add a public comment`)}"></textarea>
      <button class="btn btn--dark" type="submit">${L`Comment`}</button>
    </form>
  </section>`;
}
