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
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
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


CATEGORY_NAME = {"hackathon": "Hackathon", "tech": "Tech & AI", "startup": "Startup & business", "design": "Design",
                 "film_photo": "Film & photo", "writing": "Writing", "art": "Art", "performance": "Music & performance",
                 "science": "Science", "social_impact": "Social impact", "sports": "Sports & games", "other": "Other"}


def listing_record(raw, d) -> dict:
    """What the website gets for one competition: the facts, the verified team size,
    and the listing in English and Chinese when the LLM has read it."""
    record = raw.model_dump(exclude={"pages", "team_by_default"})
    lst = d.listing
    category = lst.category if lst else ("hackathon" if raw.team_by_default else "other")
    record.update(
        team=overall(d.tracks), tracks=[t.model_dump() for t in d.tracks], eligibility=d.eligibility,
        category=category, kind=CATEGORY_NAME[category],
        region=lst.region if lst else raw.region,
        i18n={"en": lst.en.model_dump(), "zh": lst.zh.model_dump()} if lst else {},
    )
    return record


class LLMRunner:
    """Asks the LLM about many competitions at once (a few at a time), saves the
    cache as it goes, and stops asking after 5 failures in a row."""

    def __init__(self, llm, cache, workers: int):
        self.llm, self.cache, self.workers = llm, cache, workers
        self.lock = threading.Lock()
        self.fails_in_row = 0
        self.stopped = False
        self.done = 0

    def one(self, raw, text):
        if self.stopped:
            return None
        try:
            ex = self.llm.extract(raw, text)
            with self.lock:
                self.fails_in_row = 0
                self.done += 1
                if self.done % 25 == 0:
                    self.cache.save()  # keep what is already read, even if the run stops later
                    log.info("  LLM: %d read", self.done)
            return ex
        except Exception as err:
            log.warning("  LLM failed for %s: %s", raw.id, err)
            with self.lock:
                self.fails_in_row += 1
                # A wrong model name or no credit left: stop asking, keep going without it
                if self.fails_in_row >= 5 and not self.stopped:
                    self.stopped = True
                    log.error("LLM failed 5 times in a row; the rest of this run goes without it")
            return None

    def run(self, jobs: list) -> dict:
        with ThreadPoolExecutor(max_workers=self.workers) as pool:
            futures = {raw.id: pool.submit(self.one, raw, text) for raw, text in jobs}
        return {k: f.result() for k, f in futures.items()}


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", stream=sys.stdout)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request is too much
    cfg = config_mod.load()
    cache = Cache(cfg.cache_file)
    llm = make_extractor(cfg, cache)
    log.info("LLM: %s", f"{llm.provider} {llm.model}" if llm else "not set (no ANTHROPIC_API_KEY or OPENAI_API_KEY): rules are not read this run")
    previous = json_store.previous_items(cfg)

    # 1. Every source: the list, plus the sentences that might hold the rules
    collected = []  # (source info, raws, skipped, notes, seconds)
    items: list[dict] = []
    sources: list[dict] = []
    failed = 0
    for sid, name, home, mod in SOURCES:
        started = time.time()
        try:
            raws, skipped, notes = mod.collect(cache, progress=lambda m, n=name: log.info("  %s: %s", n, m), limit=cfg.limit)
            # A site can list the same competition twice (a sitemap, or a list that shifts between pages)
            unique = list({r.id: r for r in reversed(raws)}.values())[::-1]
            if len(unique) < len(raws):
                notes = {**notes, "duplicates removed": len(raws) - len(unique)}
            collected.append(((sid, name, home), unique, skipped, notes, time.time() - started))
        except Exception as err:  # keep the last good items of this source
            failed += 1
            kept = [x for x in previous.values() if x.get("source") == sid]
            items.extend(kept)
            sources.append({"id": sid, "name": name, "url": home, "count": len(kept)})
            log.warning("%s FAILED (%s); kept %d from the last run", name, err, len(kept))
    cache.save()

    # 2. The LLM reads them, a few at a time
    answers: dict = {}
    if llm:
        jobs = [(raw, label(raw.pages)) for _, raws, *_ in collected for raw in raws if raw.pages]
        jobs = [(raw, text) for raw, text in jobs if text]
        log.info("LLM: %d competitions to read (answers already in the cache are free)", len(jobs))
        runner = LLMRunner(llm, cache, cfg.llm_workers)
        answers = runner.run(jobs)
        if runner.stopped:
            llm = None

    # 3. Check every answer and decide what to publish
    reviews: list[dict] = []
    db: list[dict] = []
    for (sid, name, home), raws, skipped, notes, seconds in collected:
        counts: dict[str, int] = {}
        listed = 0
        for raw in raws:
            text = label(raw.pages)
            ex = answers.get(raw.id)
            if ex is None and raw.id in previous and text:
                # Not read this run (no LLM, or it failed): keep what is already published, unchanged
                items.append(previous[raw.id])
                counts["kept as published"] = counts.get("kept as published", 0) + 1
                listed += 1
                continue
            d = decide(raw, ex, text)
            counts[d.status] = counts.get(d.status, 0) + 1
            if d.issues:
                reviews.append({"id": raw.id, "name": raw.name, "url": raw.url, "status": d.status,
                                "issues": [i.model_dump() for i in d.issues]})
            db.append(db_rows(raw, d, listing_record(raw, d)))
            if not d.listed:
                continue
            record = listing_record(raw, d)
            try:
                items.append(Published.model_validate(record).model_dump())  # the data contract, checked
                listed += 1
            except Exception as err:
                log.warning("  dropped %s: breaks the data contract (%s)", raw.id, err)
        sources.append({"id": sid, "name": name, "url": home, "count": listed})
        log.info("%s: %d found, %d listed, skipped %s, decisions %s, notes %s (%ds to collect)",
                 name, len(raws), listed, skipped, counts, notes, seconds)

    # 4. Save
    now = time.time()
    open_items = sorted((x for x in items if when(x) > now), key=when)
    json_store.save(cfg, open_items, sources, reviews)
    remembered = cache.save()
    log.info("Saved %d competitions, %d to review, %d pages remembered", len(open_items), len(reviews), remembered)
    if cfg.supabase_url and not re.match(r"^https://[a-z0-9]+\.supabase\.co/?$", cfg.supabase_url):
        log.error("SUPABASE_URL should look like https://abcdefghij.supabase.co (Project Settings > Data API > Project URL). "
                  "It starts with %r and is %d characters long.", cfg.supabase_url[:8], len(cfg.supabase_url))
        return 1
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
