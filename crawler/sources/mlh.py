"""MLH: student hackathons around the world, read from the season's events
page (it carries its data as JSON). MLH events are team hackathons, and each
sets its own team size on its own website, so that website is read too
(cached for a week):
  1. its home page: the visible text, plus the data it carries for search
     engines (an FAQ is often there)
  2. up to two FAQ / rules pages it links to on the same site
  3. if neither mentions a team size: the sentences inside the site's own
     scripts (sites built in the browser keep their FAQ there), kept only
     when they do mention one
The sentences about teams go to the LLM, like every other source."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

from .. import http
from ..extract.candidates import SIZE_HINT, mentions_size, relevant
from ..extract.schema import PageText, RawCompetition
from ..text import clean, data_text, one_line, script_text

LINK = re.compile(r'<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]{0,300}?)</a>', re.I)
# Links worth following, the likeliest to state a team size first
WORTH = ["faq", "rule", "guideline", "eligib", "participat", "about", "info"]
SCRIPT = re.compile(r'<script\b[^>]*src="([^"]+\.js[^"]*)"', re.I)


def page_text(html: str) -> str:
    return relevant(clean(html) + "\n" + data_text(html))


def same_site(link: str, base: str) -> bool:
    return urlparse(link).netloc == urlparse(base).netloc


def site_pages(url: str, breaker: http.Breaker) -> list[PageText] | None:
    try:
        html, base = http.get_page(url)
        breaker.ok()
    except Exception as err:
        breaker.fail(err)
        return None
    http.pause()
    out = [PageText(page="website", text=page_text(html))]
    ranked = {}
    for href, label in LINK.findall(html):
        link, words = urljoin(base, href), (href + " " + one_line(label)).lower()
        rank = next((i for i, w in enumerate(WORTH) if w in words), None)
        if rank is not None and same_site(link, base) and link.rstrip("/") != base.rstrip("/"):
            ranked[link] = min(rank, ranked.get(link, rank))
    for link in sorted(ranked, key=ranked.get)[:2]:
        try:
            out.append(PageText(page=urlparse(link).path.strip("/").split("/")[-1][:30] or "page", text=page_text(http.get(link))))
        except Exception:
            pass  # a missing FAQ page is not a reason to give up on the site
        http.pause()
    if not any(mentions_size(p.text) for p in out):
        # Built in the browser: look at the site's own scripts, the page script first
        scripts = [urljoin(base, s) for s in SCRIPT.findall(html)]
        scripts = sorted((s for s in dict.fromkeys(scripts) if same_site(s, base)), key=lambda s: not re.search(r"page|index|main|app", s))
        for src in scripts[:4]:
            try:
                # Scripts say a lot: keep only the sentences about team size, with their neighbours
                text = relevant(script_text(http.get(src)[:8_000_000]), 3000, SIZE_HINT)
            except Exception:
                continue
            finally:
                http.pause()
            # Scripts also hold the libraries' own words, so keep them only when they talk team size
            if mentions_size(text):
                out.append(PageText(page="site", text=text))
                break
    return [p for p in out if p.text.strip()]


def pages_for(url: str, cache, breaker: http.Breaker) -> list[PageText] | None:
    key = f"mlh2:{url}"
    saved = cache.get(key, max_age_days=7)
    if saved is not None:
        return [PageText(**p) for p in saved]
    pages = site_pages(url, breaker)
    if pages is None:
        return None  # unreadable: listed with the size unknown, and reported
    cache.set(key, [p.model_dump() for p in pages])
    return pages


def collect(cache=None, progress=lambda msg: None, limit=None):
    now = datetime.now(timezone.utc)
    season = now.year + 1 if now.month >= 7 else now.year
    html = http.get(f"https://www.mlh.com/seasons/{season}/events")
    m = re.search(r'<script data-page="app" type="application/json">([\s\S]*?)</script>', html)
    if not m:
        raise RuntimeError("MLH: page data not found (the page layout may have changed)")
    events: list[dict] = []

    def walk(o):
        if isinstance(o, list):
            for x in o:
                walk(x)
        elif isinstance(o, dict):
            if o.get("name") and o.get("startsAt") and (o.get("websiteUrl") or o.get("url")):
                events.append(o)
            else:
                for v in o.values():
                    walk(v)

    walk(json.loads(m.group(1)))
    items, seen, notes = [], set(), {}
    breaker = http.Breaker()
    for e in events:
        if e.get("id") in seen or datetime.fromisoformat(e["startsAt"].replace("Z", "+00:00")) <= now:
            continue
        if limit and len(items) >= limit:
            break
        seen.add(e.get("id"))
        if len(seen) % 10 == 0:
            progress(f"{len(seen)} websites read")
        fmt = e.get("formatType")
        url = e.get("websiteUrl") or f"https://www.mlh.com{e['url']}"
        pages = pages_for(url, cache, breaker) if cache is not None else []
        if pages is None:
            notes["website unreadable"] = notes.get("website unreadable", 0) + 1
        items.append(RawCompetition(
            id=f"mlh-{e.get('slug') or e.get('id')}", source="mlh", region="intl", kind="Hackathon",
            name=one_line(e["name"])[:200], organizer="MLH member event",
            url=url,
            start=e["startsAt"], end=e.get("endsAt"),
            where="Online" if fmt == "digital" else one_line(f"{e.get('location') or ''} {'(hybrid)' if fmt == 'hybrid' else ''}")[:120],
            tags=["Student hackathon"], team_by_default=True, pages=pages or [],
        ))
    return items, {}, notes
