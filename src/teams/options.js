/* What a competition card can say: roles, goals, hours and topics.
   Values are stored in English; they are shown in the chosen language. */

import { L } from '../shared/i18n.js?v=20261031p';
import ZH from '../shared/locales/zh.js?v=20261031p';


export const ROLES = ['Frontend', 'Backend', 'Design', 'Product', 'Data', 'Research', 'Marketing', 'Pitch', 'Hardware', 'Writing'];
export const GOALS = [['win', 'Aiming to win'], ['learn', 'Here to learn'], ['fun', 'Just for fun']];
export const goalName = (g) => L((GOALS.find(([v]) => v === g) || GOALS[1])[1]);
export const HOURS = [['3', 'About 3 h a week'], ['6', 'About 6 h a week'], ['10', '10+ h a week']];
export const hoursName = (h) => L((HOURS.find(([v]) => v === String(h)) || HOURS[1])[1]);
// For <select>: values stay English, labels follow the language
export const goalOptions = () => GOALS.map(([v, l]) => [v, L(l)]);
export const hourOptions = () => HOURS.map(([v, l]) => [v, L(l)]);
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
