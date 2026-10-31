/* What a competition card can say: roles, goals, hours and topics.
   Values are stored in English; they are shown in the chosen language. */

import { L } from '../shared/i18n.js?v=20261031v';
import ZH from '../shared/locales/zh.js?v=20261031v';


export const ROLES = ['Frontend', 'Backend', 'Design', 'Product', 'Data', 'Research', 'Marketing', 'Pitch', 'Hardware', 'Writing'];
export const GOALS = [['win', 'Aiming to win'], ['learn', 'Here to learn'], ['experience', 'For the experience']];
export const goalName = (g) => L((GOALS.find(([v]) => v === g) || GOALS[1])[1]);
export const HOURS = [['3', 'About 3 h a week'], ['6', 'About 6 h a week'], ['10', '10+ h a week']];
export const hoursName = (h) => L((HOURS.find(([v]) => v === String(h)) || HOURS[1])[1]);
// For <select>: values stay English, labels follow the language
export const goalOptions = () => GOALS.map(([v, l]) => [v, L(l)]);
export const hourOptions = () => HOURS.map(([v, l]) => [v, L(l)]);
// How you want to team up in this competition (spec §4 looking_for: solo / team / either)
export const LOOKING_FOR = [['either', 'Either is fine'], ['solo', 'Start a new team with people'], ['team', 'Join a team that already exists']];
export const lookingName = (v) => L((LOOKING_FOR.find(([k]) => k === v) || LOOKING_FOR[0])[1]);
// When people usually work on it (a card can tick several)
export const WHEN = [['weekday_day', 'Weekday daytime'], ['weekday_evening', 'Weekday evenings'], ['weekend', 'Weekends']];
export const whenName = (w) => L((WHEN.find(([v]) => v === w) || [w, w])[1]);
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
