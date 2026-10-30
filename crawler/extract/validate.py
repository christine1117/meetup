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


def only_about_mentors(quote: str) -> bool:
    """True when every number in the quote sits right next to a mentor word."""
    nums = list(NUMBER.finditer(quote))
    if not nums:
        return False
    near = lambda m: MENTOR.search(quote[max(0, m.start() - 8): m.end() + 8]) is not None
    return all(near(m) for m in nums)


def norm(text: str) -> str:
    """Compare quotes loosely: full-width vs half-width, spacing and case do not matter."""
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = re.sub(r"[\s　]+", "", t)
    return t.replace("～", "~").replace("–", "-").replace("—", "-")


def quoted(evidence: str, source: str) -> bool:
    e = norm(evidence)
    return len(e) >= 2 and e in norm(source)


def track_key(name: str | None) -> str:
    return norm(name or "") or "*"


def decide(comp: RawCompetition, ex: Extraction | None, source_text: str) -> Decision:
    """Turn one LLM answer into what may be published."""
    if ex is None:
        # Nothing to read (MLH lists no rules text): a hackathon is listed, size on the official page
        if not comp.pages and comp.team_by_default:
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
        if (r.min_members or r.max_members) and only_about_mentors(r.evidence):
            issues.append(Issue(code="mentors_counted", detail=f"The number seems to be about mentors ({where})"))
            continue
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

    team_ok = comp.team_by_default or any(
        r.max_members is None or r.max_members >= 2 for r in good if not (r.individual_allowed is False and r.max_members == 1)
    )
    if ex.individual_only and not any((r.max_members or 0) >= 2 for r in good):
        return Decision(status="excluded", issues=[Issue(code="individual_only", detail="Individuals only.")])
    if not good and not comp.team_by_default:
        # Not listed: either clearly not a team competition, or a person should check first
        status = "review" if issues else "excluded"
        return Decision(status=status, issues=issues or [Issue(code="no_team_rules", detail="No sign that teams can enter.")])
    if not team_ok:
        return Decision(status="excluded", issues=[Issue(code="no_team_rules", detail="Every rule is one person per entry.")])

    # Any doubt about sizes: list the competition, but do not publish sizes until a person checks
    blocking = {"conflicting_sources", "llm_unsure"}
    publish_sizes = not any(i.code in blocking for i in issues)
    tracks = []
    if publish_sizes:
        merged: dict[str, Track] = {}
        for r in good:
            k = track_key(r.track)
            t = merged.get(k) or Track(name=r.track, evidence=r.evidence)
            t.min = t.min if t.min is not None else r.min_members
            t.max = t.max if t.max is not None else r.max_members
            t.solo = t.solo if t.solo is not None else r.individual_allowed
            t.mentors = t.mentors if t.mentors is not None else r.mentors_max
            merged[k] = t
        tracks = [t for t in merged.values() if t.min or t.max or t.solo is not None]

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
    )


def overall(tracks: list[Track]) -> dict:
    """One min/max for the list view, across tracks (the detail page shows each track)."""
    mins = [t.min if t.min is not None else (1 if t.solo else None) for t in tracks]
    maxes = [t.max for t in tracks]
    return {
        "min": min(m for m in mins if m is not None) if any(m is not None for m in mins) else None,
        "max": max(m for m in maxes if m is not None) if any(m is not None for m in maxes) else None,
    }
