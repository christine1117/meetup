import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTeamSize, teamPolicy } from '../crawler/lib/team-size.js';

const size = (text) => { const r = parseTeamSize(text); return [r.min, r.max]; };

test('Chinese ranges next to team words', () => {
  assert.deepEqual(size('參賽資格：每隊3~5人，可跨校組隊'), [3, 5]);
  assert.deepEqual(size('團隊成員 2-4 人，需有一名指導老師'), [2, 4]);
  assert.deepEqual(size('以團隊報名，每組二至五人'), [2, 5]);
});

test('Chinese upper limits', () => {
  assert.deepEqual(size('個人或團體參賽皆可，團隊人數以5人為上限'), [null, 5]);
  assert.deepEqual(size('每組最多4人'), [null, 4]);
  assert.deepEqual(size('短影音類(個人、團體參賽皆可，參賽人數2人為限)'), [null, 2]);
});

test('numbers that are not team sizes are ignored', () => {
  assert.deepEqual(size('佳作20名：每名獎金新臺幣1,500元'), [null, null]);
  assert.deepEqual(size('本活動限 100 人報名，額滿為止'), [null, null]);
  assert.deepEqual(size('2026 年 11 月 13 日截止'), [null, null]);
});

test('English team sizes', () => {
  assert.deepEqual(size('Teams of up to 4 people can submit one project.'), [null, 4]);
  assert.deepEqual(size('A team may have a maximum of four (4) members.'), [null, 4]);
  assert.deepEqual(size('Team size: 2-5 members'), [2, 5]);
  assert.deepEqual(size('Each team must have at least 2 members and no more than 5 participants.'), [2, 5]);
});

test('solo-only competitions are spotted', () => {
  assert.equal(parseTeamSize('本活動採用個人報名制，限個人參賽').solo, true);
  assert.equal(parseTeamSize('This challenge is open to individuals only.').solo, true);
  assert.equal(parseTeamSize('個人或團體參賽皆可').solo, false);
});

test('policy: keep team competitions, drop solo ones', () => {
  assert.equal(teamPolicy(parseTeamSize('每隊3~5人')).keep, true);
  assert.deepEqual(teamPolicy(parseTeamSize('每隊3~5人')).team, { min: 3, max: 5 });
  assert.equal(teamPolicy(parseTeamSize('限個人參賽，每人限投一件')).keep, false);
  assert.equal(teamPolicy(parseTeamSize('徵文比賽，字數 800 字以內')).keep, false);
  // On hackathon platforms teams are the norm even when the size is not stated
  assert.equal(teamPolicy(parseTeamSize('Build something cool with AI.'), { onPlatform: true }).keep, true);
  assert.equal(teamPolicy(parseTeamSize('Individuals only. No teams.'), { onPlatform: true }).keep, false);
});
