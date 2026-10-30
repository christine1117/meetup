"""MLH: student hackathons around the world, read from the season's events
page (it carries its data as JSON). MLH events are team hackathons; each sets
its own team size on its own website, so there is no rules text to read here."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from .. import http
from ..extract.schema import RawCompetition
from ..text import one_line


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
    items, seen = [], set()
    for e in events:
        if e.get("id") in seen or datetime.fromisoformat(e["startsAt"].replace("Z", "+00:00")) <= now:
            continue
        seen.add(e.get("id"))
        fmt = e.get("formatType")
        items.append(RawCompetition(
            id=f"mlh-{e.get('slug') or e.get('id')}", source="mlh", region="intl", kind="Hackathon",
            name=one_line(e["name"])[:200], organizer="MLH member event",
            url=e.get("websiteUrl") or f"https://www.mlh.com{e['url']}",
            start=e["startsAt"], end=e.get("endsAt"),
            where="Online" if fmt == "digital" else one_line(f"{e.get('location') or ''} {'(hybrid)' if fmt == 'hybrid' else ''}")[:120],
            tags=["Student hackathon"], team_by_default=True,
        ))
    return items[:limit] if limit else items, {}, {}
