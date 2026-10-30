"""Turning page HTML into plain text."""

from __future__ import annotations

import html as htmllib
import json
import re


def clean(s: str | None) -> str:
    s = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", s or "", flags=re.I)
    s = re.sub(r"<br\s*/?>|</p>|</li>|</h\d>|</div>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = htmllib.unescape(s)
    s = re.sub(r"[ \t\r\f\v ]+", " ", s)
    return re.sub(r"\n\s*\n+", "\n", s).strip()


def one_line(s: str | None) -> str:
    return re.sub(r"\s+", " ", clean(s)).strip()


def cut(s: str, n: int) -> str:
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def meta(html: str, name: str) -> str:
    m = re.search(rf'<meta[^>]+(?:name|property|id)="{re.escape(name)}"[^>]+content="([^"]*)"', html, re.I)
    return htmllib.unescape(m.group(1)) if m else ""


def json_ld(html: str):
    m = re.search(r'<script type="application/ld\+json">([\s\S]*?)</script>', html)
    try:
        return json.loads(m.group(1)) if m else None
    except ValueError:
        return None
