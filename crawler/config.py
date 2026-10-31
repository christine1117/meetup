"""Settings, read from environment variables. Secrets never live in the code:
locally they come from your shell, on GitHub from repository secrets."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Config:
    anthropic_api_key: str | None
    openai_api_key: str | None
    llm_model: str | None  # empty: the default model of whichever provider has a key
    supabase_url: str | None
    supabase_service_key: str | None
    data_file: Path = ROOT / "data" / "competitions.json"
    review_file: Path = ROOT / "data" / "review.json"
    cache_file: Path = ROOT / "crawler" / "cache.json"
    limit: int | None = None  # for trying things out: at most this many competitions per source
    llm_workers: int = 8      # LLM calls at the same time
    llm_effort: str = "low"   # how much a reasoning model thinks first: minimal, low, medium, high (more = surer, dearer)
    llm_reread: bool = False  # read every competition again, even the ones whose page has not changed


def load() -> Config:
    # CRAWL_OUT_DIR + CRAWL_LIMIT make a quick trial run that leaves the real data alone
    out = Path(os.environ["CRAWL_OUT_DIR"]) if os.environ.get("CRAWL_OUT_DIR") else None
    extra = {"data_file": out / "competitions.json", "review_file": out / "review.json", "cache_file": out / "cache.json"} if out else {}
    return Config(
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        openai_api_key=os.environ.get("OPENAI_API_KEY") or None,
        llm_model=os.environ.get("LLM_MODEL") or None,
        supabase_url=os.environ.get("SUPABASE_URL") or None,
        supabase_service_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or None,
        limit=int(os.environ["CRAWL_LIMIT"]) if os.environ.get("CRAWL_LIMIT") else None,
        llm_workers=int(os.environ.get("LLM_WORKERS") or 8),
        llm_effort=os.environ.get("LLM_EFFORT") or "low",
        llm_reread=os.environ.get("LLM_REREAD") == "1",
        **extra,
    )
