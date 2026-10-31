/* Sample people and teams. They stand in for real accounts until there
   is a server. Each competition gets a steady handful of sample people,
   and most get one sample team. Remove this file once sign-ups are real. */

import { defaultMax } from './rules.js?v=20261031r';

export const PEOPLE = [
  { id: 'p1', alias: 'Mochi', field: 'Design', city: 'Taipei', canDo: ['Design', 'Research'], topics: ['Environment', 'Transport'], goal: 'win', hours: 10, work: 'Redesigned a bus app used by 2,000 riders', reply: 0.9, real: { name: 'Yen Shu-Wei', school: 'NCKU, Industrial Design', contact: 'shuwei@example.com' } },
  { id: 'p2', alias: 'Kite', field: 'Engineering', city: 'Taipei', canDo: ['Backend', 'Data'], topics: ['Transport', 'Environment'], goal: 'win', hours: 10, work: 'Built an open bike-lane map from GPS data', reply: 0.75, real: { name: 'Lin Kai-Wen', school: 'NTU, Computer Science', contact: 'kaiwen@example.com' } },
  { id: 'p3', alias: 'Sol', field: 'Founder', city: 'Taipei', canDo: ['Pitch', 'Product', 'Marketing'], topics: ['Money', 'Food'], goal: 'win', hours: 6, work: 'Ran a savings app with 1,300 weekly users', reply: 0.85, real: { name: 'Chen Yu-Ting', school: 'NCCU, Business', contact: 'yuting@example.com' } },
  { id: 'p4', alias: 'Nori', field: 'Content', city: 'Taichung', canDo: ['Writing', 'Marketing'], topics: ['Education', 'Social good'], goal: 'learn', hours: 6, work: 'Writes a newsletter with 4,200 readers', reply: 0.6, real: { name: 'Huang Pei-Shan', school: 'Tunghai, Sociology', contact: 'peishan@example.com' } },
  { id: 'p5', alias: 'Pim', field: 'Research', city: 'Hsinchu', canDo: ['Data', 'Research'], topics: ['Environment', 'Health'], goal: 'learn', hours: 6, work: 'Measured indoor air in 23 homes, data on GitHub', reply: 0.8, real: { name: 'Tsou Ting-An', school: 'NTHU, Environmental Engineering', contact: 'tingan@example.com' } },
  { id: 'p6', alias: 'Rue', field: 'Design', city: 'Taipei', canDo: ['Design', 'Frontend'], topics: ['Food', 'Money'], goal: 'win', hours: 10, work: 'Booking app for tattoo artists, 35 on the waitlist', reply: 0.8, real: { name: 'Wu Ruo-Xi', school: 'Shih Chien, Communication Design', contact: 'ruoxi@example.com' } },
  { id: 'p7', alias: 'Tavi', field: 'Engineering', city: 'Taipei', canDo: ['Backend', 'Data', 'Hardware'], topics: ['Health', 'AI'], goal: 'fun', hours: 3, work: 'Speech-to-notes tool piloted in 3 clinics', reply: 0.95, real: { name: 'Hsu Chih-Hao', school: 'NYCU, Electrical Engineering', contact: 'chihhao@example.com' } },
  { id: 'p8', alias: 'Ode', field: 'Business', city: 'Taichung', canDo: ['Marketing', 'Pitch'], topics: ['Food', 'Social good'], goal: 'learn', hours: 6, work: 'Supplies 9 restaurants with farm produce', reply: 0.65, real: { name: 'Lai Po-Jui', school: 'Tunghai, International Business', contact: 'pojui@example.com' } },
  { id: 'p9', alias: 'Juno', field: 'Engineering', city: 'Tainan', canDo: ['Frontend'], topics: ['Education', 'AI'], goal: 'learn', hours: 10, work: 'Shipped three small web apps for local shops', reply: 0.9, real: { name: 'Kuo Yi-Jun', school: 'NCKU, Computer Science', contact: 'yijun@example.com' } },
  { id: 'p10', alias: 'Bao', field: 'Founder', city: 'Taipei', canDo: ['Product', 'Pitch'], topics: ['Food', 'Education'], goal: 'win', hours: 6, work: 'Took a campus food app to 800 users', reply: 0.7, real: { name: 'Tsai Wei-Lun', school: 'NTU, Economics', contact: 'weilun@example.com' } },
];
// Friends that join through an invite link in the demo
export const FRIENDS = [
  { id: 'f1', alias: 'Pebble', field: 'Engineering', city: 'Taipei', canDo: ['Backend'], topics: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Lee Hsin-Yi', school: 'NTU, Information Management', contact: 'hsinyi@example.com' } },
  { id: 'f2', alias: 'Fig', field: 'Design', city: 'Taipei', canDo: ['Design'], topics: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Chang Ya-Ting', school: 'NTUST, Design', contact: 'yating@example.com' } },
  { id: 'f3', alias: 'Moss', field: 'Business', city: 'Taipei', canDo: ['Marketing'], topics: [], goal: 'win', hours: 6, work: 'Your friend', reply: 0.9, real: { name: 'Liu Chia-Hui', school: 'NCCU, Marketing', contact: 'chiahui@example.com' } },
];
export const ALL_PEOPLE = [...PEOPLE, ...FRIENDS];
export const P = Object.fromEntries(ALL_PEOPLE.map((p) => [p.id, p]));
// What your own teammates say to someone you are all talking to
export const MATE_LINES = [
  'Welcome! Which part would you want to own?',
  'We meet online twice a week. Would that work for you?',
  'Could you share something you built? Even a small thing is fine.',
];
export const LINES = [
  'Nice to meet you. What made you sign up for this one?',
  'I usually handle that part. How much time can you put in each week?',
  'Do you have something you built before? I like seeing real work.',
  'I think our skills fit. Want to try teaming up?',
  'Let us split the first week: you take the idea, I take the build.',
];

/* Sample people and teams. Until real sign-ups exist, each competition
   gets a steady handful of sample people, and most get one sample team. */
export const hashOf = (str) => [...str].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7);
export const demoPeople = (cid) => [...PEOPLE].sort((a, b) => hashOf(cid + a.id) - hashOf(cid + b.id)).slice(0, 6);
export const TEAM_NAMES = ['Clear Air', 'Night Market Labs', 'Kind Robots', 'Tiny Giants', 'Open Loop', 'Late Night Build'];
export const PITCHES = [
  'A map that warns parents when the air near their kid’s school gets bad.',
  'Pre-order from night market stalls and skip the line.',
  'A small desk robot that reminds older people to take their medicine.',
  'Helping small shops turn receipts into simple sales charts.',
  'A study buddy that turns lecture notes into quick quizzes.',
  'Showing renters which flats get the most sunlight.',
];
export const NEEDS = [['Frontend'], ['Design'], ['Pitch'], ['Data'], ['Backend', 'Design'], []];
export function seedTeam(cid) {
  const h = hashOf(cid);
  if (h % 3 === 0) return null;
  const [a, b] = demoPeople(cid);
  return { id: `st-${cid}`, comp: cid, name: TEAM_NAMES[h % TEAM_NAMES.length], pitch: PITCHES[(h >> 3) % PITCHES.length], members: [a.id, b.id], needs: NEEDS[(h >> 5) % NEEDS.length], max: defaultMax(cid), seed: true };
}
