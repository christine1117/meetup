"""Devpost: international hackathons.

The list comes from the public JSON the Devpost site itself uses. For each
hackathon we keep the sentences about teams and eligibility from its
overview and rules pages, plus Devpost's own "Who can participate" box
(cached for a week), for the LLM to read.
Teams are the norm on Devpost, so a hackathon is listed even before its
rules are read."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from .. import http
from ..extract.candidates import relevant
from ..extract.schema import PageText, RawCompetition
from ..text import clean, one_line

MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def dates(text: str = "") -> tuple[str | None, str | None]:
    """'Oct 01 - Nov 12, 2026', 'Dec 15, 2025 - Jan 20, 2026', 'Nov 01 - 02, 2026' -> (start, deadline)"""
    a, _, b = (text or "").partition(" - ")
    end = re.match(r"^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$", b.strip()) or re.match(r"^(\d{1,2}), (\d{4})$", b.strip())
    if not end:
        return None, None
    year = int(end.groups()[-1])
    start = re.match(r"^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?$", a.strip())
    end_month = MONTHS[end.group(1)] if len(end.groups()) == 3 else (MONTHS[start.group(1)] if start else None)
    end_day = int(end.group(2) if len(end.groups()) == 3 else end.group(1))
    if end_month is None:
        return None, None
    deadline = datetime(year, end_month, end_day, 23, 59, tzinfo=timezone.utc)
    begin = datetime(int(start.group(3) or year), MONTHS[start.group(1)], int(start.group(2)), tzinfo=timezone.utc) if start else None
    iso = lambda d: d.isoformat().replace("+00:00", ".000Z")
    return (iso(begin) if begin else None), iso(deadline)


# The site's own menus and banners, which repeat on every page and mention "Teams"
CHROME = re.compile(r"Devpost for Teams|private hackathons|Host a public hackathon|unsupported browser|Drive innovation, collaboration|Webinars & events|Join a hackathon|Log in Sign up"
                    r"|Best practices for planning|Upcoming events and on-demand", re.I)
# Whole lines that are menu items: "Log in", "My projects", "Participants (80)", ...
MENU = re.compile(r"^(?:Log in|Sign up|Overview|My projects|Participants \(\d+\)|Resources|Rules|Project gallery|Updates|Discussions"
                  r"|Find more hackathons|View full rules|Planning guides|Hackathons|Projects|Portfolio)$", re.I)


def strip_chrome(text: str) -> str:
    """Drop the menus line by line, then sentence by sentence. Line by line first:
    the menu has no full stops, so as one "sentence" it would take the lines
    after it (such as "Who can participate") away with it."""
    out = []
    for line in text.split("\n"):
        if MENU.match(line.strip()):
            continue
        kept = [s for s in re.split(r"(?<=[.!?])\s+", line) if not CHROME.search(s)]
        if kept:
            out.append(" ".join(kept))
    return "\n".join(out)


# Devpost's own "Who can participate" box: ages, students only, countries
WHO = re.compile(r"Who can participate\s*\n([\s\S]{0,800}?)\n\s*View full rules", re.I)


def who_can_enter(text: str) -> PageText | None:
    m = WHO.search(text)
    lines = [x.strip() for x in m.group(1).split("\n") if x.strip()] if m else []
    return PageText(page="who can participate", text="\n".join(lines)) if lines else None


def pages_for(url: str, cache, breaker: http.Breaker) -> list[PageText] | None:
    key = f"devpost4:{url}"
    saved = cache.get(key, max_age_days=7)
    if saved is not None:
        return [PageText(page=p["page"], text=strip_chrome(p["text"])) for p in saved]
    base = url.rstrip("/") + "/"
    out = []
    for name, link in (("overview", base), ("rules", base + "rules")):
        try:
            page = clean(http.get(link))
            who = who_can_enter(page) if name == "overview" else None
            if who:
                out.append(who)
            out.append(PageText(page=name, text=relevant(strip_chrome(page))))
            breaker.ok()
        except Exception as err:
            breaker.fail(err)
        http.pause()
    if not out:
        return None  # unreadable: listed with the size unknown, and reported
    cache.set(key, [p.model_dump() for p in out])
    return out


def collect(cache, progress=lambda msg: None, limit=None):
    items: list[RawCompetition] = []
    skipped: dict[str, int] = {}
    notes: dict[str, int] = {}
    breaker = http.Breaker()
    seen = 0
    for page in range(1, 41):
        data = http.get(f"https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page={page}", as_json=True)
        batch = data.get("hackathons") or []
        for h in batch:
            if limit and len(items) >= limit:
                break
            seen += 1
            if seen % 25 == 0:
                progress(f"{seen} checked")
            if h.get("invite_only"):
                skipped["invite only"] = skipped.get("invite only", 0) + 1
                continue
            pages = pages_for(h["url"], cache, breaker)
            if pages is None:
                notes["pages unreadable"] = notes.get("pages unreadable", 0) + 1
            start, deadline = dates(h.get("submission_period_dates", ""))
            items.append(RawCompetition(
                id=f"dp-{h['id']}", source="devpost", region="intl", kind="Hackathon",
                name=one_line(h.get("title"))[:200], organizer=one_line(h.get("organization_name"))[:200],
                url=h["url"], start=start, deadline=deadline,
                where=one_line((h.get("displayed_location") or {}).get("location"))[:120],
                tags=[one_line(t["name"])[:60] for t in h.get("themes") or []][:5],
                prize=re.sub(r"\s+", "", one_line(h.get("prize_amount")))[:60],
                team_by_default=True, pages=pages or [],
            ))
        meta = data.get("meta") or {}
        if (limit and len(items) >= limit) or not batch or page * (meta.get("per_page") or 9) >= (meta.get("total_count") or 0):
            break
        http.pause()
    return items, skipped, notes
