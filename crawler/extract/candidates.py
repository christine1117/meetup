"""Step 1: find the paragraphs that might hold the rules.

This step only narrows the page down, so it is generous on purpose: a
sentence is kept if it so much as mentions teams, people, entries or who can
enter, together with the sentence before and after it for context. The LLM
reads these and decides; nothing here decides a team size.
"""

from __future__ import annotations

import re

from .schema import PageText

CUES = re.compile(
    r"隊|組|團|個人|單人|雙人|兩人|多人|人數|成員|名額|指導|老師|參賽資格|參加資格|報名資格|參賽對象|參加對象|徵件對象|對象|資格|"
    r"team|individual|solo|member|participant|people|person|entr(?:y|ies|ant)|eligib|who can|open to|"
    r"student|mentor|advisor|coach|group",
    re.I,
)
SPLIT = re.compile(r"(?<=[。；;！!？?])|(?<=\.)\s+|\n+")


def sentences(text: str) -> list[str]:
    return [s.strip() for s in SPLIT.split(re.sub(r"[ \t　]+", " ", text)) if s and s.strip()]


def relevant(text: str, limit: int = 4000) -> str:
    """The sentences of one page worth showing the LLM (plus their neighbours)."""
    parts = sentences(text)
    keep: set[int] = set()
    for i, s in enumerate(parts):
        if CUES.search(s):
            keep.update({i - 1, i, i + 1})
    return " ".join(parts[i] for i in sorted(keep) if 0 <= i < len(parts))[:limit]


def label(pages: list[PageText], limit: int = 8000) -> str:
    """One text for the LLM, each page labelled: "[rules] ...", "[overview] ..."."""
    out, used = [], 0
    for p in pages:
        if not p.text.strip() or used >= limit:
            continue
        block = f"[{p.page}] {p.text}"[: limit - used]
        out.append(block)
        used += len(block)
    return "\n\n".join(out)
