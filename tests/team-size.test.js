import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTeamSize, teamPolicy } from '../crawler/lib/team-size.js';

const size = (text) => { const r = parseTeamSize(text); return [r.min, r.max]; };

// Sentences below come from real competition pages
test('ranges next to team words', () => {
  assert.deepEqual(size('參賽資格：每隊3~5人，可跨校組隊'), [3, 5]);
  assert.deepEqual(size('團隊成員 2-4 人，需有一名指導老師'), [2, 4]);
  assert.deepEqual(size('以團隊報名，每組二至五人'), [2, 5]);
});

test('alone or as a team: the range starts at 1', () => {
  assert.deepEqual(size('歡迎全球的建築師參與。可以個人或最多8人的團隊形式參賽，強烈鼓勵跨領域合作。'), [1, 8]);
  assert.deepEqual(size('參賽形式：個人獨立報名，或最多4人團隊報名，團隊統一繳納單筆報名費'), [1, 4]);
  assert.deepEqual(size('參賽形式：個人獨立參賽，或最多4人組隊參賽。學生優惠：3人以上同校團隊可透過學校官方郵件申請'), [1, 4]);
  assert.deepEqual(size('學士/碩士在學學生個人或兩人以下團體參賽'), [1, 2]);
  assert.deepEqual(size('不限年齡、職業與錄音經驗。可個人或雙人組隊參賽。'), [1, 2]);
  assert.deepEqual(size('個人或團體參賽皆可，團隊人數以5人為上限'), [1, 5]);
  assert.deepEqual(size('Participants may compete individually or in teams of up to 20 eligible students.'), [1, 20]);
  assert.deepEqual(size('參賽形式：個人獨立參賽，或組隊參賽，團隊人數無上限'), [1, null]);
});

test('exact team sizes', () => {
  assert.deepEqual(size('至官方 LINE 登記組隊（每隊3人）'), [3, 3]);
  assert.deepEqual(size('每組參賽隊伍由四人組成，每一隊均須有一名指導老師'), [4, 4]);
  assert.deepEqual(size('每隊均由四名隊員組成。每人限報名一隊。'), [4, 4]);
  assert.deepEqual(size('參賽隊伍須由2名學生共同組成，不受理個人報名。每隊須設有指導老師1名。'), [2, 2]);
  assert.deepEqual(size('報名費用：1組2人，共新台幣2,100元整'), [2, 2]);
});

test('minimums', () => {
  assert.deepEqual(size('以學校為單位進行團體報名，每組應有 2 名以上參賽學生，並至少有 1 名指導老師'), [2, null]);
});

test('upper limits', () => {
  assert.deepEqual(size('每組最多4人'), [null, 4]);
  assert.deepEqual(size('短影音類(個人、團體參賽皆可，參賽人數2人為限)'), [1, 2]);
});

test('numbers that are not team sizes are ignored', () => {
  assert.deepEqual(size('佳作20名：每名獎金新臺幣1,500元'), [null, null]);
  assert.deepEqual(size('本活動限 100 人報名，額滿為止'), [null, null]);
  assert.deepEqual(size('清華光罩卓越獎：每組 1 名（共 4 名），每名獎金 10 萬元。'), [null, null]);
  assert.deepEqual(size('特優獎每組取 3 名，共 9 名'), [null, null]);
  assert.deepEqual(size('開放名額：各組別開放名額皆為2,500人'), [null, null]);
});

test('English team sizes', () => {
  assert.deepEqual(size('Teams of up to 4 people can submit one project.'), [null, 4]);
  assert.deepEqual(size('A team may have a maximum of four (4) members.'), [null, 4]);
  assert.deepEqual(size('Team size: 2-5 members'), [2, 5]);
  assert.deepEqual(size('Each team must have at least 2 members and no more than 5 participants.'), [2, 5]);
  assert.deepEqual(size('Teams can have between 2 and 4 members.'), [2, 4]);
  assert.deepEqual(size('Form teams of 1-4 and build anything.'), [1, 4]);
});

test('teams that are not the participants do not count', () => {
  assert.equal(parseTeamSize('評審團隊：國際資深攝影師、畫廊策展人').teams, false);
  assert.equal(parseTeamSize('以簡要文字說明：尊重生命、團隊合作、自主自律').teams, false);
  assert.equal(parseTeamSize('The judging team will review all entries.').teams, false);
});

test('solo-only competitions are spotted', () => {
  assert.equal(parseTeamSize('本活動採用個人報名制，限個人參賽').solo, true);
  assert.equal(parseTeamSize('This challenge is open to individuals only.').solo, true);
  assert.equal(parseTeamSize('僅接受個人獨立原創作品，不允許團隊合作、聯合創作投稿').solo, true);
  assert.equal(parseTeamSize('個人或團體參賽皆可').solo, false);
});

test('policy: keep team competitions, drop solo ones', () => {
  assert.equal(teamPolicy(parseTeamSize('每隊3~5人')).keep, true);
  assert.deepEqual(teamPolicy(parseTeamSize('每隊3~5人')).team, { min: 3, max: 5 });
  assert.equal(teamPolicy(parseTeamSize('限個人參賽，每人限投一件')).keep, false);
  assert.equal(teamPolicy(parseTeamSize('徵文比賽，字數 800 字以內')).keep, false);
  assert.equal(teamPolicy(parseTeamSize('Build something cool with AI.'), { onPlatform: true }).keep, true);
  assert.equal(teamPolicy(parseTeamSize('Individuals only. No teams.'), { onPlatform: true }).keep, false);
});
