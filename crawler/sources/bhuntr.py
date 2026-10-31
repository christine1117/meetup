"""獎金獵人 bhuntr.com: competitions in Taiwan.

Reads the public contest sitemap, then each contest page's schema.org data
and description (the same data search engines read). A page is fetched again
only when its last-modified date changes. Whether teams may enter is decided
later by the LLM, from the sentences kept here."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone

from .. import http
from ..extract.candidates import relevant
from ..extract.schema import PageText, RawCompetition
from ..text import clean, cut, json_ld, meta, one_line

# Words every bhuntr page carries; they say nothing about the contest
GENERIC = {"獎金獵人", "比賽", "競賽", "徵件", "報名系統", "投票系統", "線上報名", "線上投票", "網路投票", "報名平台", "活動報名系統",
           "活動廣告", "活動宣傳", "活動網站架設", "參賽行事曆", "歷屆比賽", "國內", "國外", "學生", "學生競賽", "其他"}
# Drop a leading heading like "一、活動簡介" or "前言" so the summary starts with the point
HEADING = re.compile(r"^([一二三四五六七八九十]+[、.．]\s*)?(活動|比賽|競賽|計畫)?(簡介|介紹|前言|緣起|宗旨|說明|目的|背景)\s*[:：]?\s*")


def kind_of(words: list[str]) -> str:
    w = " ".join(words)
    for kind, pattern in (("Hackathon", r"黑客松|hackathon"), ("Startup & business", r"創業|新創|商業|提案|企劃|行銷"),
                          ("Tech", r"程式|AI|人工智慧|資料|數據|科技|資訊|工程|機器人"), ("Design", r"設計|建築|產品"),
                          ("Film & photo", r"影片|影像|攝影|動畫|微電影"), ("Writing", r"寫作|文學|徵文|劇本"),
                          ("Art", r"繪畫|插畫|美術|藝術|漫畫"), ("Music & stage", r"音樂|歌唱|舞蹈|表演")):
        if re.search(pattern, w, re.I):
            return kind
    return "Competition"


def iso(ms: float) -> str:
    return datetime.fromtimestamp(ms, tz=timezone.utc).isoformat().replace("+00:00", ".000Z")


def read_contest(cid: str, mod: str | None, cache) -> dict:
    key = f"bhuntr4:{cid}"
    saved = cache.get(key, mod=mod)
    if saved is not None:
        return saved
    page = http.get(f"https://bhuntr.com/tw/competitions/{cid}")
    http.pause()
    ev = next((x for x in ((json_ld(page) or {}).get("@graph") or []) if x.get("@type") == "Event"), None)
    end = None
    if ev and ev.get("endDate"):
        try:
            end = datetime.fromisoformat(ev["endDate"].replace("Z", "")).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            end = None
    if not ev or not ev.get("name"):
        value = {"skip": "no contest data"}
    elif not end or end - time.time() < 2 * 3600:
        # A closed contest shows "now" as its end date, so keep only ones that end later
        value = {"skip": "closed"}
    else:
        desc = one_line(meta(page, "description"))
        words = [w.strip() for w in str(ev.get("keywords") or "").split(",") if w.strip()]
        mode = str(ev.get("eventAttendanceMode") or "")
        start = None
        if ev.get("startDate"):
            try:
                start = iso(datetime.fromisoformat(ev["startDate"].replace("Z", "")).replace(tzinfo=timezone.utc).timestamp())
            except ValueError:
                start = None
        value = {"record": {
            "id": f"bh-{cid}", "source": "bhuntr",
            "region": "intl" if any(re.search(r"國外|國際", w) for w in words) else "tw",
            "kind": kind_of(words), "name": cut(one_line(ev["name"]), 200),
            "organizer": cut(one_line((ev.get("organizer") or {}).get("name")), 200),
            "url": f"https://bhuntr.com/tw/competitions/{cid}", "start": start, "deadline": iso(end),
            # Nearly every page says "mixed", which tells us nothing, so only clear answers are kept
            "where": "Online" if "Online" in mode else "In person" if "Offline" in mode else "",
            "tags": [cut(w, 60) for w in words if w not in GENERIC][:5],
            "summary": cut(HEADING.sub("", desc), 120),
            "pages": [{"page": "description", "text": relevant(f"{one_line(ev['name'])}。{clean(meta(page, 'description'))}")}],
        }}
    cache.set(key, value, mod)
    return value


def collect(cache, progress=lambda msg: None, limit=None):
    xml = http.get("https://bhuntr.com/sitemap_v2_contest_latest.xml")
    entries = []
    for block in re.findall(r"<url>([\s\S]*?)</url>", xml):
        loc = re.search(r"<loc>([^<]+)</loc>", block)
        mod = re.search(r"<lastmod>([^<]+)</lastmod>", block)
        if loc:
            entries.append((loc.group(1).rstrip("/").split("/")[-1], mod.group(1) if mod else None))
    items, skipped = [], {}
    breaker = http.Breaker()
    for i, (cid, mod) in enumerate(entries):
        if limit and len(items) >= limit:
            break
        if i and i % 50 == 0:
            progress(f"{i} of {len(entries)} checked")
        try:
            got = read_contest(cid, mod, cache)
            breaker.ok()
        except http.TooManyFailures:
            raise
        except Exception as err:
            skipped["page failed"] = skipped.get("page failed", 0) + 1
            breaker.fail(err)
            continue
        if "skip" in got:
            skipped[got["skip"]] = skipped.get(got["skip"], 0) + 1
            continue
        items.append(RawCompetition(**got["record"]))
    return items, skipped, {}
