"""The daily crawl.

  1. Sources list open competitions and keep the sentences that might hold
     the rules (regex only narrows the text down; it decides nothing)
  2. An LLM reads those sentences and returns team-size rules and eligibility
     in a fixed shape (Pydantic)
  3. The validator checks every answer (quotes must really be on the page,
     min <= max, no mentors counted, no conflicts) and decides what to publish
  4. Saved to data/competitions.json + data/review.json, and to the database
     when SUPABASE_URL is set

Without ANTHROPIC_API_KEY or OPENAI_API_KEY, step 2 is skipped: competitions already published
stay as they were, hackathons are listed with the size on the official page,
and other new competitions wait (pending) until they can be read.

Run: npm run crawl   (or: .venv/bin/python -m crawler)"""

from __future__ import annotations

import logging
import sys
import time
from datetime import datetime, timezone

from . import config as config_mod
from .cache import Cache
from .extract.candidates import label
from .extract.llm import make_extractor
from .extract.schema import Published
from .extract.validate import decide, overall
from .sources import bhuntr, devpost, mlh
from .store import json_store
from .store.supabase_store import SupabaseStore, db_rows

SOURCES = [
    ("devpost", "Devpost", "https://devpost.com/hackathons", devpost),
    ("mlh", "MLH", "https://www.mlh.com", mlh),
    ("bhuntr", "獎金獵人", "https://bhuntr.com/tw/competitions", bhuntr),
]

log = logging.getLogger("crawler")


def when(x: dict) -> float:
    for k in ("deadline", "start"):
        if x.get(k):
            return datetime.fromisoformat(x[k].replace("Z", "+00:00")).timestamp()
    return float("inf")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stdout)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request is too much
    cfg = config_mod.load()
    cache = Cache(cfg.cache_file)
    llm = make_extractor(cfg, cache)
    log.info("LLM: %s", f"{llm.provider} {llm.model}" if llm else "not set (no ANTHROPIC_API_KEY or OPENAI_API_KEY): rules are not read this run")
    previous = json_store.previous_items(cfg)

    items: list[dict] = []
    reviews: list[dict] = []
    db: list[dict] = []
    sources: list[dict] = []
    failed = 0
    for sid, name, home, mod in SOURCES:
        started = time.time()
        try:
            raws, skipped, notes = mod.collect(cache, progress=lambda m, n=name: log.info("  %s: %s", n, m), limit=cfg.limit)
        except Exception as err:  # keep the last good items of this source
            failed += 1
            kept = [x for x in previous.values() if x.get("source") == sid]
            items.extend(kept)
            sources.append({"id": sid, "name": name, "url": home, "count": len(kept)})
            log.warning("%s FAILED (%s); kept %d from the last run", name, err, len(kept))
            continue

        counts: dict[str, int] = {}
        listed = 0
        for raw in raws:
            text = label(raw.pages)
            ex = None
            if llm and text:
                try:
                    ex = llm.extract(raw, text)
                except Exception as err:
                    log.warning("  LLM failed for %s: %s", raw.id, err)
            elif not llm and raw.id in previous and text:
                # No LLM this run: keep what is already published, unchanged
                items.append(previous[raw.id])
                counts["kept as published"] = counts.get("kept as published", 0) + 1
                listed += 1
                continue
            d = decide(raw, ex, text)
            counts[d.status] = counts.get(d.status, 0) + 1
            if d.issues:
                reviews.append({"id": raw.id, "name": raw.name, "url": raw.url, "status": d.status,
                                "issues": [i.model_dump() for i in d.issues]})
            db.append(db_rows(raw, d, None))
            if not d.listed:
                continue
            record = raw.model_dump(exclude={"pages", "team_by_default"})
            record.update(team=overall(d.tracks), tracks=[t.model_dump() for t in d.tracks], eligibility=d.eligibility)
            try:
                items.append(Published.model_validate(record).model_dump())  # the data contract, checked
                listed += 1
            except Exception as err:
                log.warning("  dropped %s: breaks the data contract (%s)", raw.id, err)
        sources.append({"id": sid, "name": name, "url": home, "count": listed})
        log.info("%s: %d found, %d listed, skipped %s, decisions %s, notes %s (%ds)",
                 name, len(raws), listed, skipped, counts, notes, time.time() - started)

    now = time.time()
    open_items = sorted((x for x in items if when(x) > now), key=when)
    json_store.save(cfg, open_items, sources, reviews)
    remembered = cache.save()
    log.info("Saved %d competitions, %d to review, %d pages remembered%s",
             len(open_items), len(reviews), remembered, f", {llm.calls} LLM calls" if llm else "")
    if cfg.supabase_url and cfg.supabase_service_key:
        try:
            SupabaseStore(cfg.supabase_url, cfg.supabase_service_key).save(db)
            log.info("Saved %d competitions to the database", len(db))
        except Exception as err:
            log.error("Database save failed: %s", err)
            return 1
    if failed == len(SOURCES):
        log.error("Every source failed. Check the network or the source pages.")
        return 1
    return 0
