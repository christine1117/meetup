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
# Says how big a team can be ("teams of up to 4", "2-4 members", "最多 5 人"). Only used to
# decide whether to look further on a site; the LLM still reads and decides.
_N = r"(?:\d{1,2}|one|two|three|four|five|six|seven|eight)"
SIZE_HINT = re.compile(
    rf"team(?:s)?\s+(?:size|sizes|of\s+(?:up\s+to\s+)?{_N}|can\s+(?:have|be|consist)|must|may\s+(?:have|consist)|consist|between|up\s+to)"
    rf"|(?:max(?:imum)?|min(?:imum)?|up\s+to|at\s+most|at\s+least)\s+(?:of\s+)?{_N}\s+(?:team\s*)?(?:members|people|participants|hackers|persons|students)"
    rf"|{_N}\s*(?:-|–|to)\s*{_N}\s+(?:members|people|participants|hackers|persons|students)"
    r"|每隊|每組|人數|[1-9一二三四五六七八九十]\s*(?:至|到|-|–|~|～)\s*[1-9一二三四五六七八九十]\s*(?:人|名)|最多\s*[1-9一二三四五六七八九十]+\s*(?:人|名)",
    re.I,
)
SPLIT = re.compile(r"(?<=[。；;！!？?])|(?<=\.)\s+|\n+")


def sentences(text: str) -> list[str]:
    return [s.strip() for s in SPLIT.split(re.sub(r"[ \t　]+", " ", text)) if s and s.strip()]


def mentions_size(text: str) -> bool:
    return bool(SIZE_HINT.search(text or ""))


# Sentences that say who may enter or how big a team is. On a long page they are kept first,
# so a long list of tracks cannot push "參賽資格 … 每隊不超過 8 人" past the limit.
STRONG = re.compile(r"參賽資格|參加資格|報名資格|參賽對象|參加對象|徵件對象|資格|每隊|每組|人數|成員|指導老師|國籍|"
                    r"eligib|who can|open to|team size|per team|members", re.I)


def relevant(text: str, limit: int = 4000, cues: re.Pattern = CUES) -> str:
    """The sentences of one page worth showing the LLM (plus their neighbours), in page order.
    Within the limit, the sentences about eligibility and team size are picked first."""
    parts = sentences(text)
    hits = [i for i, s in enumerate(parts) if cues.search(s)]
    strong = [i for i in hits if STRONG.search(parts[i]) or SIZE_HINT.search(parts[i])]
    keep: set[int] = set()
    used = 0
    for i in strong + hits:
        for j in (i - 1, i, i + 1):
            if 0 <= j < len(parts) and j not in keep and used + len(parts[j]) + 1 <= limit:
                keep.add(j)
                used += len(parts[j]) + 1
    if not keep and hits:  # one sentence longer than the limit: keep its start
        return parts[hits[0]][:limit]
    return " ".join(parts[i] for i in sorted(keep))


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
