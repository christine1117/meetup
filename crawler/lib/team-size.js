/* Read a competition's rules text and work out its team size.

   parseTeamSize(text) returns { min, max, teams, solo }:
   - min / max: people per team, or null when the text does not say
   - teams: the text talks about teams (組隊, 團隊, 每隊, team, teams…)
   - solo: the text says it is for individuals only (限個人, individuals only…)

   Pure function, no network: tested in tests/team-size.test.js.
   Numbers only count when they sit next to team words, so prize counts
   ("佳作 20 名") and sign-up caps ("限 100 人") are not mistaken for sizes. */

const CN = { 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const EN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const MAX_TEAM = 20;

function num(token) {
  if (token == null) return null;
  const t = String(token).trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  if (t in EN) return EN[t];
  if (t in CN) return CN[t];
  if (/^十[一二三四五六七八九]$/.test(t)) return 10 + CN[t[1]];
  return null;
}

const N = '(\\d{1,2}|[一二兩两三四五六七八九十]{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)';
const DASH = '\\s*(?:-|–|—|~|～|－|至|到|to)\\s*';
const ZH_TEAM = /(隊|組隊|團隊|團體|組員|隊員|每組|小組)/;
const EN_TEAM = /\bteams?\b|team members?/i;

const SOLO = [
  /限個人|僅限個人|個人參賽|以個人(?:名義|為單位)?(?:參賽|報名|投稿)|不(?:接受|得)(?:團體|組隊)|恕不接受團體/,
  /\bindividuals? only\b|\bsolo (?:only|participants only)\b|\bno teams\b|must (?:participate|compete|enter|submit) (?:as an )?individual(?:ly|s)?\b|individual (?:entries|participation|submissions) only/i,
];
const TEAMS_OK = [
  /組隊|團隊|團體(?:組|參賽|報名)|每隊|每組|隊伍|隊員|組員|個人或團體|個人、團體|團體皆可/,
  /\bteams?\b|\bteam members?\b|\bteammates?\b/i,
];

// Both are fine: 個人或團體皆可 / individuals or teams
const MIXED = [/個人或團體|個人、團體|個人及團體|團體皆可|個人\/團體/, /\bindividuals? (?:or|and) teams?\b|\bteams? (?:or|and) individuals?\b|solo or (?:in )?(?:a )?teams?/i];

// Each rule: a pattern, and what its numbers mean
const RULES = [
  // 每隊 3~5 人 / 團隊 2-4 人 / teams of 2 to 4 people
  { re: new RegExp(`${N}${DASH}${N}\\s*(?:人|名|位|members?|people|persons|participants|individuals)`, 'gi'), get: (m) => ({ min: num(m[1]), max: num(m[2]) }), near: true },
  // 上限 5 人 / 最多 4 人 / 至多 4 名 / 不超過 6 人
  { re: new RegExp(`(?:上限(?:為)?|最多|至多|不(?:得)?超過|以)\\s*${N}\\s*(?:人|名|位)`, 'g'), get: (m) => ({ max: num(m[1]) }), near: true },
  // 5 人為上限 / 4 人以內 / 6 名以下 / 3 人為限
  { re: new RegExp(`${N}\\s*(?:人|名|位)\\s*(?:為上限|以內|以下|為限)`, 'g'), get: (m) => ({ max: num(m[1]) }), near: true },
  // 至少 2 人 / 最少 3 名 / 須 2 人以上
  { re: new RegExp(`(?:至少|最少|最低|須|需)\\s*${N}\\s*(?:人|名|位)`, 'g'), get: (m) => ({ min: num(m[1]) }), near: true },
  // 3 人一組 / 4 人為一隊
  { re: new RegExp(`${N}\\s*人\\s*(?:為)?\\s*一\\s*(?:組|隊)`, 'g'), get: (m) => ({ min: num(m[1]), max: num(m[1]) }), near: false },
  // up to 4 members / a maximum of four (4) people / no more than 5 participants
  { re: new RegExp(`(?:up to|maximum of|max(?:imum)?|at most|no more than|not (?:to )?exceed|limited to)\\s*${N}\\s*(?:\\(\\d+\\)\\s*)?(?:team\\s*)?(?:members?|people|persons|participants|individuals|hackers)`, 'gi'), get: (m) => ({ max: num(m[1]) }), near: true },
  // teams of up to 4 / team size: 4 / teams of 3
  { re: new RegExp(`teams? (?:of|size(?: is)?:?|sizes? of)\\s*(?:up to|at most|a maximum of|max(?:imum)?)?\\s*${N}\\b`, 'gi'), get: (m) => ({ max: num(m[1]) }), near: false },
  // at least 2 members / minimum of 3 people
  { re: new RegExp(`(?:at least|minimum of|min(?:imum)?)\\s*${N}\\s*(?:team\\s*)?(?:members?|people|persons|participants)`, 'gi'), get: (m) => ({ min: num(m[1]) }), near: true },
];

// Is there a team word just before (or right after) this match?
function nearTeam(text, index, length) {
  const before = text.slice(Math.max(0, index - 40), index);
  const after = text.slice(index + length, index + length + 6);
  return ZH_TEAM.test(before) || EN_TEAM.test(before) || /^\s*(?:一組|一隊|為一組|為一隊|per team|each team|a team|per group)/i.test(after);
}

export function parseTeamSize(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ');
  const mins = [];
  const maxes = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      if (rule.near && !nearTeam(text, m.index, m[0].length)) continue;
      const got = rule.get(m);
      if (got.min != null && got.min >= 1 && got.min <= MAX_TEAM) mins.push(got.min);
      if (got.max != null && got.max >= 1 && got.max <= MAX_TEAM) maxes.push(got.max);
    }
  }
  let max = maxes.length ? Math.max(...maxes) : null;
  let min = mins.length ? Math.min(...mins) : null;
  if (min != null && max != null && min > max) min = null;
  if (min === 1) min = null; // "1–5 people" reads better as "up to 5"
  // "No teams" mentions teams but means the opposite, so negations are taken out first
  const positive = text.replace(/\bno teams\b|不(?:接受|得)(?:團體|組隊)|恕不接受團體/gi, ' ');
  const mixed = MIXED.some((re) => re.test(text));
  const solo = max === 1 || (SOLO.some((re) => re.test(text)) && !mixed && !(max != null && max >= 2));
  const teams = !solo && (mixed || TEAMS_OK.some((re) => re.test(positive)) || (max != null && max >= 2));
  return { min, max: max === 1 ? null : max, teams, solo };
}

/* Decide whether a competition belongs on the list.
   onPlatform: true for hackathon sites (Devpost, MLH), where teams are the
   norm, so "not stated" still counts as a team competition. */
export function teamPolicy(info, { onPlatform = false } = {}) {
  if (info.solo) return { keep: false, reason: 'individuals only' };
  if (info.max != null && info.max < 2) return { keep: false, reason: 'one person per entry' };
  if (info.teams || info.max != null || onPlatform) return { keep: true, team: { min: info.min, max: info.max } };
  return { keep: false, reason: 'no sign of teams' };
}
