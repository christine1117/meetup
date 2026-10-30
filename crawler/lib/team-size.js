/* Read a competition's rules text and work out its team size.

   parseTeamSize(text) returns { min, max, teams, solo }:
   - min / max: people per entry, or null when the text does not say.
     When the rules let one person enter alone ("個人或最多8人的團隊"),
     min is 1, so the page can say "1–8 people".
   - teams: the text says participants can enter as a team
   - solo: the text says individuals only

   Pure function, no network: tested in tests/team-size.test.js with real
   sentences from competition pages.
   A number only counts when it sits next to a team word (before or after),
   so prize counts ("每組取 3 名", "佳作 20 名") and sign-up caps
   ("各組別開放名額 2,500 人") are not read as team sizes. Teams that are
   not the participants (評審團隊, 主辦團隊…) do not count either. */

const CN = { 一: 1, 二: 2, 兩: 2, 两: 2, 雙: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const EN = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const MAX_TEAM = 30;

function num(token) {
  if (token == null) return null;
  const t = String(token).trim().toLowerCase();
  if (/^\d+$/.test(t)) return Number(t);
  if (t in EN) return EN[t];
  if (t in CN) return CN[t];
  if (/^十[一二三四五六七八九]$/.test(t)) return 10 + CN[t[1]];
  return null;
}

const N = '(\\d{1,2}|十[一二三四五六七八九]|[一二兩两雙三四五六七八九十]|one|two|three|four|five|six|seven|eight|nine|ten)';
const DASH = '\\s*(?:-|–|—|~|～|－|至|到|to|and)\\s*';
const UNIT = '(?:人|名|位)';
const EN_UNIT = '(?:members?|people|persons|participants|individuals|students|hackers)';

// Teams that belong to the organizers, judges or brands, not to participants
const NOT_PARTICIPANTS = /(評審|評選|主辦|承辦|協辦|技術|工作|策展|顧問|籌備|行政|執行|服務|醫療|編輯|專業|客服|管理|經營|行銷|品牌|官方|委員會|組委會)團隊|團隊合作(?!投稿|參賽|報名)|\b(?:judging|organi[sz]ing|technical|support|editorial) team\b/gi;

// Words that mean "participants form a team"
const TEAM_WORD = /組隊|每隊|隊伍|隊員|隊長|雙人組|每組(?:人數|成員|最多|至多|上限|限|須由|由)|團體(?:組|報名|參賽|投稿|賽|申請|創作)|團隊(?:報名|參賽|投稿|形式|人數|成員|合作投稿|組|賽)|以團隊|或團隊|或團體|或組隊|團隊或個人|團體或個人|組成(?:之|的)?(?:團隊|隊伍)|\bteams? of\b|\bin (?:a )?teams?\b|\bas a team\b|\bteam members?\b|\bteammates?\b|\bteam (?:size|registration|entries|submissions?|leader)\b|\bor (?:as )?(?:a )?teams?\b|\bteams? (?:can|may|must|should|are allowed|will)\b|\bper team\b|\beach team\b/i;

// One person may enter alone, or as a team
const MIXED = /個人[^。；;!！?？]{0,14}或[^。；;!！?？]{0,10}(?:組隊|團隊|團體|雙人|兩人|多人|\d+\s*人|[二兩三四五六七八]人)|(?:個人|單人)、團體|團體皆可|個人及團體|個人\/團體|個人或團體|團隊或個人|團體或個人|\bindividual(?:ly|s)? or (?:in |as )?(?:a )?teams?\b|\bteams? or individuals?\b|\bsolo or (?:in |as )?(?:a )?teams?\b/i;

const SOLO = /限個人|僅限個人|僅接受個人|個人參賽制|以個人(?:名義|為單位)?(?:參賽|報名|投稿)|不(?:接受|允許|得)(?:團體|團隊|組隊)|恕不接受團體|\bindividuals? only\b|\bsolo (?:only|participants only)\b|\bno teams\b|must (?:participate|compete|enter|submit) (?:as an )?individual(?:ly|s)?\b|individual (?:entries|participation|submissions) only/i;

const UNLIMITED = /團隊人數(?:沒有|無|不設)上限|人數不限|不限人數|\bno (?:limit|maximum) (?:on|to) (?:the )?team size\b|\bteam size is unlimited\b/i;

// Prize lists reuse the same words ("每組取 3 名", "每組 1 名（共 4 名）")
const PRIZE_AFTER = /^\s*(?:（|\()?(?:共|，?每名|獎|元|名額)/;

// Each rule: a pattern, and what its numbers mean
const RULES = [
  // 每隊 3~5 人 / 團隊 2-4 人 / teams of 2 to 4 people / between 2 and 4 members
  { re: new RegExp(`${N}${DASH}${N}\\s*(?:${UNIT}|${EN_UNIT})`, 'gi'), get: (m) => ({ min: num(m[1]), max: num(m[2]) }) },
  // teams of 1-4 (no unit)
  { re: new RegExp(`teams? of\\s*${N}${DASH}${N}\\b`, 'gi'), get: (m) => ({ min: num(m[1]), max: num(m[2]) }), self: true },
  // 上限 5 人 / 最多 4 人 / 最多可 8 人 / 至多 4 名 / 不超過 6 人
  { re: new RegExp(`(?:上限(?:為)?|最多|至多|不(?:得|可)?超過|以)\\s*(?:可|可以|為|是)?\\s*${N}\\s*${UNIT}`, 'g'), get: (m) => ({ max: num(m[1]) }) },
  // 5 人為上限 / 4 人以內 / 兩人以下 / 3 人為限
  { re: new RegExp(`${N}\\s*${UNIT}\\s*(?:為上限|以內|以下|為限)`, 'g'), get: (m) => ({ max: num(m[1]) }) },
  // 至少 2 人 / 最少 3 名 / 2 名以上 / 2人以上
  { re: new RegExp(`(?:至少|最少|最低)\\s*${N}\\s*${UNIT}|${N}\\s*${UNIT}\\s*以上`, 'g'), get: (m) => ({ min: num(m[1] || m[2]) }) },
  // 每隊 3 人 / 每組參賽隊伍由四人組成 / 由 2 名學生共同組成 / 1組2人 / 雙人組隊
  { re: new RegExp(`(?:每隊|每組|每團隊|一隊|一組|1\\s*組|1\\s*隊)(?:人數)?\\s*(?:為|限|須|需|均|皆)?\\s*${N}\\s*${UNIT}`, 'g'), get: (m) => ({ min: num(m[1]), max: num(m[1]) }), prizeCheck: true, self: true },
  { re: new RegExp(`由\\s*${N}\\s*${UNIT}[^。；，,]{0,6}組成`, 'g'), get: (m) => ({ min: num(m[1]), max: num(m[1]) }) },
  { re: new RegExp(`${N}\\s*人\\s*(?:為)?\\s*一\\s*(?:組|隊)`, 'g'), get: (m) => ({ min: num(m[1]), max: num(m[1]) }), self: true },
  { re: /雙人(?:組隊|一組|組|團隊)/g, get: () => ({ max: 2 }), self: true },
  // up to 4 members / a maximum of four (4) people / no more than 5 participants
  { re: new RegExp(`(?:up to|maximum of|max(?:imum)?|at most|no more than|not (?:to )?exceed|limited to)\\s*${N}\\s*(?:\\(\\d+\\)\\s*)?(?:team\\s*)?${EN_UNIT}`, 'gi'), get: (m) => ({ max: num(m[1]) }) },
  // teams of up to 4 / team size: 4 / teams of 3 (but not "teams of 1-4", handled above)
  { re: new RegExp(`teams? (?:of|size(?: is)?:?|sizes? of)\\s*(?:up to|at most|a maximum of|max(?:imum)?)?\\s*${N}\\b(?!${DASH}\\d)`, 'gi'), get: (m) => ({ max: num(m[1]) }), self: true },
  // at least 2 members / minimum of 3 people
  { re: new RegExp(`(?:at least|minimum of|min(?:imum)?)\\s*${N}\\s*(?:team\\s*)?${EN_UNIT}`, 'gi'), get: (m) => ({ min: num(m[1]) }) },
];

// Is there a participant team word just before or just after this match?
function nearTeam(text, index, length) {
  const around = text.slice(Math.max(0, index - 40), index + length + 12);
  return TEAM_WORD.test(around) || MIXED.test(around);
}

export function parseTeamSize(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').replace(NOT_PARTICIPANTS, ' ');
  const mins = [];
  const maxes = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text))) {
      if (!rule.self && !nearTeam(text, m.index, m[0].length)) continue;
      if (rule.prizeCheck && (PRIZE_AFTER.test(text.slice(m.index + m[0].length, m.index + m[0].length + 8)) || /取\s*$/.test(text.slice(Math.max(0, m.index - 3), m.index)))) continue;
      const got = rule.get(m);
      if (got.min != null && got.min >= 1 && got.min <= MAX_TEAM) mins.push(got.min);
      if (got.max != null && got.max >= 1 && got.max <= MAX_TEAM) maxes.push(got.max);
    }
  }
  const mixed = MIXED.test(text);
  let max = maxes.length ? Math.max(...maxes) : null;
  // One person may enter alone: that sets the minimum, whatever else the text says about discounts
  // Several minimums ("2 名以上參賽學生", "至少 1 名指導老師"): the larger one is about the team
  let min = mixed ? 1 : mins.length ? Math.max(...mins) : null;
  if (min != null && max != null && min > max) min = mixed ? 1 : null;
  const solo = max === 1 || (SOLO.test(text) && !mixed && !(max != null && max >= 2));
  const teams = !solo && (mixed || TEAM_WORD.test(text) || (max != null && max >= 2) || (min != null && min >= 2) || UNLIMITED.test(text));
  if (teams && UNLIMITED.test(text) && max == null) min = min || 1;
  return { min: solo ? null : min, max: max === 1 ? null : max, teams, solo };
}

/* Decide whether a competition belongs on the list.
   onPlatform: true for hackathon sites (Devpost, MLH), where teams are the
   norm, so "not stated" still counts as a team competition. */
export function teamPolicy(info, { onPlatform = false } = {}) {
  if (info.solo) return { keep: false, reason: 'individuals only' };
  if (info.teams || info.max != null || onPlatform) return { keep: true, team: { min: info.min, max: info.max } };
  return { keep: false, reason: 'no sign of teams' };
}

/* The part of a page worth keeping for team size: sentences that talk about
   teams, people or entries. Saved in the crawler cache, so a better parser
   can be run again later without fetching every page again. */
export function teamText(raw, limit = 3000) {
  const parts = String(raw || '').replace(/\s+/g, ' ').split(/(?<=[。；;!！?？])|(?<=\.)\s+/);
  const keep = parts.filter((s) => /隊|組|團|個人|單人|雙人|兩人|多人|人數|成員|team|individual|solo|member|participant|people|person|entr(?:y|ies)/i.test(s));
  return keep.join(' ').slice(0, limit);
}
