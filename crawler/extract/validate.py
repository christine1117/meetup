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

Understanding the wording ("1名組長及1~5名組員" is 2–6 people, "一件作品" is not a
person) is the LLM's job. The code only checks what needs no understanding: the
quote is on the page, min <= max, two pages agree, the LLM is sure.

Pure functions: tested in crawler/tests/test_validate.py.
"""

from __future__ import annotations

import re
import unicodedata

from .schema import Decision, Extraction, Issue, RawCompetition, TeamRule, Track


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
            t = merged.get(k) or Track(name=r.track, evidence=r.evidence, name_en=r.track_en, name_zh=r.track_zh)
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
