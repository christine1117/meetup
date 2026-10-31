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


# ---------- Text a page keeps outside its visible HTML ----------
# Many hackathon sites are built in the browser: the visible HTML is nearly
# empty, and the FAQ lives in the page's data or in its scripts.

def _strings(o, out: list[str]) -> None:
    if isinstance(o, str):
        out.append(o)
    elif isinstance(o, list):
        for x in o:
            _strings(x, out)
    elif isinstance(o, dict):
        for v in o.values():
            _strings(v, out)


def prose(s: str) -> bool:
    """A sentence written for people, not an id, a link or a piece of code."""
    s = s.strip()
    return len(s) >= 12 and len(s.split()) >= 3 and not re.search(r"https?://|[{};<>]|=>|\b(?:function|return|const|var)\b", s)


def data_text(html: str) -> str:
    """Sentences from the data a page carries for search engines and its own
    scripts: schema.org JSON-LD (an FAQ, say) and Next.js page data."""
    out: list[str] = []
    for m in re.finditer(r'<script[^>]*(?:type="application/ld\+json"|id="__NEXT_DATA__")[^>]*>([\s\S]*?)</script>', html or "", re.I):
        try:
            _strings(json.loads(m.group(1)), out)
        except ValueError:
            continue
    lines = (one_line(x) for x in out)
    return "\n".join(dict.fromkeys(x for x in lines if prose(x)))


# A run of text between two quote marks that has no code characters in it. Quotes
# are not paired up (a regular expression or an apostrophe in minified code would
# throw that off); runs of code between strings are dropped by prose() later.
SPAN = re.compile(r"""(?<=["'`])(?:[^"'`\\\n{}<>;=]|\\u[0-9a-fA-F]{4}|\\[nrt"'`\\]|(?<=[A-Za-z])'(?=[A-Za-z]))+(?=["'`])""")
CODE = re.compile(r"[\[\]|&]|\)\(|\b(?:function|return|const|var|undefined)\b")


def script_text(js: str) -> str:
    """Sentences written inside a site's JavaScript: its quoted strings that read like prose."""
    out: list[str] = []
    for m in SPAN.finditer(js or ""):
        s = m.group(0)
        if len(s) < 12 or len(s) > 3000 or CODE.search(s):
            continue
        s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda u: chr(int(u.group(1), 16)), s)
        s = re.sub(r"\\[nrt]", " ", s)
        s = re.sub(r"\\(.)", r"\1", s)
        s = one_line(s)
        if prose(s):
            out.append(s)
    return "\n".join(dict.fromkeys(out))
