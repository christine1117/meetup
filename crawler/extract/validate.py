"""Step 3: check what the LLM returned before anything is published.

| Situation                                      | What happens                              |
|------------------------------------------------|-------------------------------------------|
| min 5, max 2                                   | error: rule dropped, sent for review      |
| Only a maximum is stated                       | min stays null (never filled in)          |
| Different tracks (高中組, 大專組)               | kept as separate tracks                   |
| Overview says 2–4, rules page says 3–5         | conflict: sizes not published, review     |
| "最多 5 名學生及 1 名指導老師"                    | mentors kept apart from participants      |
| The quote is not in the source text            | that rule's sizes are not published       |
| The LLM says it is unsure                      | sizes not published, review               |

Pure functions: tested in crawler/tests/test_validate.py.
"""

from __future__ import annotations

import re
import unicodedata

from .schema import Decision, Extraction, Issue, RawCompetition, TeamRule, Track

MENTOR = re.compile(r"指導老師|指導教師|指導教授|老師|教師|顧問|mentors?|advisors?|advisers?|coach(?:es)?|supervisors?", re.I)
NUMBER = re.compile(r"\d+|[一二兩三四五六七八九十]+")


MENTOR_BEFORE = re.compile(r"(?:指導老師|指導教師|指導教授|老師|教師|顧問|mentors?|advisors?|coach(?:es)?)\s*(?:人數|為|需|須|:|：)?\s*(?:\d+\s*[-~～至到]\s*)?$", re.I)
MENTOR_AFTER = re.compile(r"^\s*(?:[-~～至到]\s*\d+\s*)?(?:名|位|人)?\s*(?:的)?\s*(?:指導老師|指導教師|指導教授|老師|教師|顧問|mentors?|advisors?|coach(?:es)?)", re.I)


CN_NUM = {"一": 1, "二": 2, "兩": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
EN_NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5}


def mentor_counts(quote: str) -> set[int]:
    """The numbers in a quote that count mentors ("1 位指導老師", "指導老師1-2名", "one mentor")."""
    found: set[int] = set()
    for m in re.finditer(r"\d+|[一二兩三四五六七八九十]|\b(?:one|two|three|four|five)\b", quote, re.I):
        before, after = quote[max(0, m.start() - 10): m.start()], quote[m.end(): m.end() + 10]
        if MENTOR_BEFORE.search(before) or MENTOR_AFTER.match(after):
            t = m.group(0).lower()
            found.add(int(t) if t.isdigit() else CN_NUM.get(t) or EN_NUM.get(t) or 0)
    return found


NUM_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
             "一": 1, "二": 2, "兩": 2, "两": 2, "雙": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
NUM_TOKEN = r"\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|[一二兩两雙三四五六七八九十]"
PEOPLE = (r"(?:人|名|位|成員|隊員|組員|組長|隊長|學生|參賽者|members?|people|persons?|participants?|individuals?|students?"
          r"|hackers?|builders?|teammates?|creators?)")
# After a number: maybe the rest of a range or list ("–5", " and 4", ", 2, or 3"), then who is counted
PEOPLE_AFTER = re.compile(rf"^\)?(?:\s*\(\s*\d+\s*\))?(?:\s*(?:-|–|—|~|～|至|到|to|and|or|,)\s*(?:or\s+)?(?:{NUM_TOKEN})){{0,3}}\s*(?:名|位|個)?\s*(?:的)?\s*{PEOPLE}", re.I)
TEAM_NEAR = re.compile(r"隊|組|團|teams?\b|groups?\b|squads?\b|crews?\b", re.I)
SOLO = re.compile(r"solo|individual|alone|on your own|by yourself|個人|單人|獨立參賽", re.I)
# A track only for individuals ("僅限個人報名", "compete individually"): not a team size to show
INDIVIDUAL_ONLY = re.compile(r"僅限個人|限個人|僅接受個人|個人賽|單一作者|individual(?:ly)? only|compete individually|solo only|single author", re.I)
# Roles that add up to a team: "1名組長及1~5名組員" is 2 to 6 people (mentors are not roles here)
ROLE = re.compile(rf"({NUM_TOKEN})(?:\s*(?:-|–|~|～|至|到)\s*({NUM_TOKEN}))?\s*(?:名|位|個)?\s*(?:的)?\s*"
                  r"(組長|隊長|組員|隊員|成員|學生|leaders?|captains?|members?|students?)", re.I)


def _value(token: str) -> int:
    t = token.lower()
    return int(t) if t.isdigit() else NUM_WORDS.get(t, 0)


def roles_add_up(quote: str, n: int) -> bool:
    """n is what the roles in the quote add up to, at their lowest or at their highest."""
    lows = highs = count = 0
    for m in ROLE.finditer(quote):
        low = _value(m.group(1))
        lows, highs, count = lows + low, highs + (_value(m.group(2)) if m.group(2) else low), count + 1
    return count >= 2 and n in (lows, highs)


def number_is_about_people(quote: str, n: int) -> bool:
    """Is n in the quote as a count of people ("每隊 3 人", "teams of 2–5 participants"),
    not of something else ("每人限提交 1 件作品")? Also true when the quote says it another
    way: a minimum of 1 for "solo or in a team", or roles that add up to n."""
    words = [w for w, v in NUM_WORDS.items() if v == n]
    pattern = rf"(?<!\d){n}(?!\d)" + ("|" + "|".join(rf"\b{w}\b" if w.isascii() else w for w in words) if words else "")
    for m in re.finditer(pattern, quote, re.I):
        after = quote[m.end(): m.end() + 30]
        around = quote[max(0, m.start() - 30): m.end() + 20]
        if PEOPLE_AFTER.match(after) or TEAM_NEAR.search(around):
            return True
    if n == 1 and SOLO.search(quote):
        return True
    return roles_add_up(quote, n)


def only_about_mentors(quote: str) -> bool:
    """True when every number in the quote is a count of mentors
    ("指導老師1名", "1 名指導老師", "one mentor"), not of participants."""
    nums = list(NUMBER.finditer(quote))
    if not nums:
        return False
    is_mentor = lambda m: bool(MENTOR_BEFORE.search(quote[max(0, m.start() - 10): m.start()]) or MENTOR_AFTER.match(quote[m.end(): m.end() + 10]))
    return all(is_mentor(m) for m in nums)


def norm(text: str) -> str:
    """Compare quotes loosely: full-width vs half-width, spacing and case do not matter."""
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = re.sub(r"[\s　]+", "", t)
    return t.replace("～", "~").replace("–", "-").replace("—", "-")


QUOTES = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "「": '"', "」": '"'})
# Where an LLM joins quotes from different places: "...", "…", a line break, or a sentence end
PIECES = re.compile(r"\s*(?:\.\.\.|…|\n)\s*|(?<=[。；;!?！？])|(?<=\.)\s+")


def quoted(evidence: str, source: str) -> bool:
    """Every piece of the quote has to be on the page, word for word.
    (An LLM sometimes joins two sentences that are not next to each other.)"""
    src = norm((source or "").translate(QUOTES))
    pieces = [norm(p.translate(QUOTES)).strip(".。,，;；:：") for p in PIECES.split(evidence or "")]
    pieces = [p for p in pieces if len(p) >= 2]
    return bool(pieces) and all(p in src for p in pieces)


def track_key(name: str | None) -> str:
    return norm(name or "") or "*"


def decide(comp: RawCompetition, ex: Extraction | None, source_text: str) -> Decision:
    """Turn one LLM answer into what may be published."""
    if ex is None:
        # Nothing to read (MLH lists no rules text): a hackathon is listed, size on the official page
        if comp.team_by_default and not (source_text or "").strip():
            return Decision(status="published", listed=True)
        # Not read yet (no API key, or the call failed): hackathon sites can still be listed
        return Decision(status="pending", listed=comp.team_by_default,
                        issues=[Issue(code="not_read", detail="The rules have not been read by the LLM yet.")])

    issues: list[Issue] = []
    if ex.needs_review:
        issues.append(Issue(code="llm_unsure", detail=ex.review_reason or "The LLM marked this as unclear."))

    good: list[TeamRule] = []
    for r in ex.team_rules:
        where = f"{r.track or 'all'}: \"{r.evidence[:80]}\""
        if not quoted(r.evidence, source_text):
            issues.append(Issue(code="evidence_not_found", detail=f"Quote not in the page, sizes not published ({where})"))
            continue
        if r.min_members is not None and r.max_members is not None and r.min_members > r.max_members:
            issues.append(Issue(code="min_greater_than_max", detail=f"min {r.min_members} > max {r.max_members} ({where})"))
            continue
        # A quote that only talks about teachers cannot be a participant count
        sizes = [n for n in (r.min_members, r.max_members) if n is not None]
        if sizes and not all(number_is_about_people(r.evidence, n) for n in sizes):
            issues.append(Issue(code="number_not_about_people", detail=f"The quote does not give that number of people ({where})"))
            continue
        if (r.min_members or r.max_members) and only_about_mentors(r.evidence):
            issues.append(Issue(code="mentors_counted", detail=f"The number seems to be about mentors ({where})"))
            continue
        # An individuals-only track (max 1) is not a team size: left out quietly
        if (r.max_members == 1 or (r.max_members is None and r.min_members == 1)) and INDIVIDUAL_ONLY.search(r.evidence):
            continue
        # A mentor count is only kept if the quote gives that number for mentors
        if r.mentors_max is not None and r.mentors_max not in mentor_counts(r.evidence):
            r = r.model_copy(update={"mentors_max": None})
        good.append(r)

    # The same track with different sizes on different pages is a conflict
    seen: dict[str, tuple] = {}
    for r in good:
        size = (r.min_members, r.max_members)
        if size == (None, None):
            continue
        k = track_key(r.track)
        if k in seen and seen[k] != size:
            issues.append(Issue(code="conflicting_sources",
                                detail=f"{r.track or 'all'}: {seen[k]} vs {size}. Check the official rules."))
        seen.setdefault(k, size)

    # Only competitions where people can enter as a team are listed: the text has to say so
    # (a size of 2 or more, "no limit on team size", or plainly "teams may enter").
    # Hackathon sites are team events by nature, so they are listed either way.
    team_ok = comp.team_by_default or ex.teams_allowed is True or any(
        (r.max_members or 0) >= 2 or (r.min_members or 0) >= 2 or r.unlimited for r in good
    )
    if ex.individual_only and not any((r.max_members or 0) >= 2 for r in good):
        return Decision(status="excluded", issues=[Issue(code="individual_only", detail="Individuals only.")])
    if not team_ok:
        # Not listed: the text never says people can enter as a team (or a person should check first)
        status = "review" if issues and good else "excluded"
        return Decision(status=status, issues=issues + [Issue(code="no_team_rules", detail="The text does not say people can enter as a team.")])

    # Any doubt about sizes: list the competition, but do not publish sizes until a person checks
    blocking = {"conflicting_sources", "llm_unsure"}
    publish_sizes = not any(i.code in blocking for i in issues)
    tracks = []
    if publish_sizes:
        merged: dict[str, Track] = {}
        for r in good:
            k = track_key(r.track)
            t = merged.get(k) or Track(name=r.track, evidence=r.evidence, name_en=r.track_en, name_zh=r.track_zh,
                                       evidence_en=r.evidence_en, evidence_zh=r.evidence_zh)
            t.min = t.min if t.min is not None else r.min_members
            t.max = t.max if t.max is not None else r.max_members
            t.solo = t.solo if t.solo is not None else r.individual_allowed
            t.mentors = t.mentors if t.mentors is not None else r.mentors_max
            t.unlimited = t.unlimited or r.unlimited or None
            merged[k] = t
        tracks = [t for t in merged.values() if t.min or t.max or t.unlimited]

    elig = ex.eligibility
    elig_ok = bool(elig and quoted(elig.evidence, source_text))
    if elig and not elig_ok:
        issues.append(Issue(code="eligibility_evidence_not_found", detail="Eligibility quote not in the page; not published."))
    return Decision(
        status="review" if issues else "published",
        listed=True,
        tracks=tracks,
        eligibility=elig.summary if elig_ok else None,
        eligibility_evidence=elig.evidence if elig_ok else None,
        issues=issues,
        listing=ex.listing,
    )


def overall(tracks: list[Track]) -> dict:
    """One min/max for the list view, across tracks (the detail page shows each track).
    The maximum is only known if every track that allows teams states one.
    "unlimited" when a track says there is no limit on team size."""
    if not tracks:
        return {"min": None, "max": None, "unlimited": False}
    if any(t.unlimited for t in tracks):
        return {"min": None, "max": None, "unlimited": True}
    mins = [t.min if t.min is not None else (1 if t.solo else None) for t in tracks]
    team_tracks = [t for t in tracks if t.max is None or t.max >= 2]
    maxes = [t.max for t in team_tracks]
    top = max(maxes) if maxes and all(m is not None for m in maxes) else None
    low = min(m for m in mins if m is not None) if all(m is not None for m in mins) else None
    if low is not None and top is not None and low > top:
        low = None
    return {"min": low, "max": top if top is not None and top >= 2 else None, "unlimited": False}
