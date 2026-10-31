"""Polite HTTP: a clear User-Agent, a timeout, retries with a growing pause,
and a pause between pages. Pages use the default Accept header, because some
sites refuse an explicit "Accept: text/html" from a bot."""

from __future__ import annotations

import time

import httpx

USER_AGENT = "HalfSugarBot/1.0 (+https://meetup.christine921117.workers.dev/privacy)"
PAUSE = 0.7  # seconds between pages on the same site

_client = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=20, follow_redirects=True)


def _fetch(url: str, as_json: bool, tries: int) -> httpx.Response:
    last: Exception | None = None
    for attempt in range(1, tries + 1):
        try:
            r = _client.get(url, headers={"Accept": "application/json"} if as_json else None)
            r.raise_for_status()
            return r
        except Exception as err:  # network errors and bad status codes alike
            last = err
            if attempt < tries:
                time.sleep(1.5 * attempt)
    raise last  # type: ignore[misc]


def get(url: str, *, as_json: bool = False, tries: int = 3):
    r = _fetch(url, as_json, tries)
    return r.json() if as_json else r.text


def get_page(url: str, *, tries: int = 3) -> tuple[str, str]:
    """(html, the address it ended up at after redirects), to follow its links."""
    r = _fetch(url, False, tries)
    return r.text, str(r.url)


def pause() -> None:
    time.sleep(PAUSE)


class TooManyFailures(Exception):
    """Several pages in a row failed: the network or the site is probably down."""


class Breaker:
    def __init__(self, limit: int = 5):
        self.limit, self.in_row = limit, 0

    def ok(self) -> None:
        self.in_row = 0

    def fail(self, err: Exception) -> None:
        self.in_row += 1
        if self.in_row >= self.limit:
            raise TooManyFailures(f"{self.in_row} pages failed in a row ({err})")
