"""Step 4 (for now): save what the website reads, plus the review list.

data/competitions.json  the published list (the data contract)
data/review.json        competitions a person should check, and why
Once the database is set up, store/supabase_store.py saves the same things there."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", "utf8")


def save(cfg, items: list[dict], sources: list[dict], reviews: list[dict]) -> None:
    write_json(cfg.data_file, {"updatedAt": now_iso(), "sources": sources, "items": items})
    write_json(cfg.review_file, {"updatedAt": now_iso(), "items": reviews})


def previous_items(cfg) -> dict[str, dict]:
    try:
        return {x["id"]: x for x in json.loads(cfg.data_file.read_text("utf8")).get("items", [])}
    except (OSError, ValueError):
        return {}
