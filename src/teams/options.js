/* What a competition card can say: roles, goals, hours and topics.
   Values are stored in English; they are shown in the chosen language. */

import { L, LANG } from '../shared/i18n.js?v=20261031z';
import ZH from '../shared/locales/zh.js?v=20261031z';


export const ROLES = ['Frontend', 'Backend', 'Design', 'Product', 'Data', 'Research', 'Marketing', 'Pitch', 'Hardware', 'Writing'];
export const GOALS = [['win', 'Aiming to win'], ['learn', 'Here to learn'], ['experience', 'For the experience']];
export const goalName = (g) => L((GOALS.find(([v]) => v === g) || GOALS[1])[1]);
export const HOURS = [['3', 'About 3 h a week'], ['6', 'About 6 h a week'], ['10', '10+ h a week']];
export const hoursName = (h) => L((HOURS.find(([v]) => v === String(h)) || HOURS[1])[1]);
// For <select>: values stay English, labels follow the language
export const goalOptions = () => GOALS.map(([v, l]) => [v, L(l)]);
export const hourOptions = () => HOURS.map(([v, l]) => [v, L(l)]);
// When people usually work on it: a day and a part of it, e.g. mon_eve, sat_am
export const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
export const PARTS = [['am', 'Morning'], ['pm', 'Afternoon'], ['eve', 'Evening']];
export const SLOTS = DAYS.flatMap(([d]) => PARTS.map(([p]) => `${d}_${p}`));
// "Mon Evening, Sat Morning/Afternoon" (in Chinese: 週一晚、週六早/午)
export const slotsText = (list = []) => DAYS.map(([d, day]) => {
  const parts = PARTS.filter(([p]) => list.includes(`${d}_${p}`)).map(([, part]) => L(part));
  return parts.length ? `${L(day)}${LANG === 'zh' ? '' : ' '}${parts.join('/')}` : '';
}).filter(Boolean).join(L`, `);
export const TOPICS = ['Environment', 'Health', 'Education', 'Money', 'Food', 'Transport', 'Social good', 'AI'];
export const MAX_ROLES = 2;

// Your topic is written in your own words; for matching we look for the topic
// words (English or Chinese) in it
export const topicsIn = (text = '') => TOPICS.filter((t) => {
  const s = String(text).toLowerCase();
  return s.includes(t.toLowerCase()) || (ZH[t] && s.includes(ZH[t]));
});
// Older cards stored ticked topics; newer ones a sentence
export const cardTopics = (card) => (card && (card.topics || []).length ? card.topics : topicsIn(card && card.topic));
