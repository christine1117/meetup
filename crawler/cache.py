"""What the crawler already looked up, so a daily run only fetches pages (and
asks the LLM about texts) that are new or changed. Saved as crawler/cache.json.

Each entry: {at: when saved, mod: the page's last-modified date if known, value}."""

from __future__ import annotations

import json
import time
from pathlib import Path

DAY = 86400


class Cache:
    def __init__(self, path: Path):
        self.path = path
        try:
            self.data = json.loads(path.read_text("utf8"))
        except (OSError, ValueError):
            self.data = {}
        self.used: set[str] = set()

    def get(self, key: str, *, mod: str | None = None, max_age_days: float = 7):
        e = self.data.get(key)
        if not e:
            return None
        fresh = e.get("mod") == mod if mod else time.time() - e.get("at", 0) < max_age_days * DAY
        if not fresh:
            return None
        self.used.add(key)
        return e["value"]

    def set(self, key: str, value, mod: str | None = None) -> None:
        self.data[key] = {"at": time.time(), "mod": mod, "value": value}
        self.used.add(key)

    def save(self) -> int:
        # Forget anything not seen this run, so the file does not grow forever
        kept = {k: v for k, v in self.data.items() if k in self.used}
        self.path.write_text(json.dumps(kept, ensure_ascii=False, separators=(",", ":")) + "\n", "utf8")
        return len(kept)
