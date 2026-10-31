#!/usr/bin/env python3
"""Translate new interface text into Chinese, without anyone online.

Runs every day before the crawl (and any time with `npm run translate`):
  1. Finds every English interface text in src/ (L`...`, L('...'), and the
     lists and messages that are translated when shown)
  2. Picks the ones missing from src/shared/locales/zh.js
  3. Asks the LLM (OPENAI_API_KEY or ANTHROPIC_API_KEY) to translate them,
     with a style guide and examples from the lines already there
  4. Checks each answer ({0} placeholders kept, product names kept) and adds
     the good ones. Lines already in zh.js are never changed, so a fix made by
     hand stays.
Without an API key it only reports what is missing."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ZH_FILE = ROOT / "src" / "shared" / "locales" / "zh.js"
HEADER = """/* Traditional Chinese for the interface. One line per English text.
   Written by tools/translate_ui.py (run daily with the crawler): new English
   text found in src/ is translated by the LLM and added here. Fix any line by hand;
   the tool never overwrites a line that is already here. */
"""

# Names and slogans that stay in English in the Chinese interface
KEEP_ENGLISH = ["Half Sugar", "Explore", "Brew", "Mystery Cup", "First Sip", "Pop the seal", "Refill", "Boba run",
                "Gone cold", "Devpost", "MLH", "LinkedIn", "Instagram", "Email"]
SLOGANS = ["Boba chat, not coffee chat.", "Meet the person before the résumé.", "Conversation before credentials.",
           "I want to meet someone.", "I need someone for something.", "You can’t pick the flavor."]

STYLE = f"""You translate a website's interface from English into Traditional Chinese as used in Taiwan.
Write like a Taiwanese product team would: short, clear, standard interface wording that is polite and
neutral. Not chatty or spoken: avoid particles and fillers like 吧、啦、喔、一下、試試、就好.
Avoid stiff or machine-sounding phrasing too. Use full-width Chinese punctuation.
Keep these names in English exactly as they are: {", ".join(KEEP_ENGLISH)}.
Keep {{0}}, {{1}}... placeholders exactly; they are filled with names or numbers.
Keep any HTML tags as they are. Translate the meaning, not word for word.
Return a JSON object: {{"translations": {{"<English>": "<Chinese>", ...}}}} with every English text given."""


# ---------- 1. Find the interface text ----------

def template_key(src: str, i: int) -> tuple[str, int]:
    """src[i] is the opening backtick of L`...`; return the key as L builds it ({0}, {1}...)."""
    parts, n, j, buf = [], 0, i + 1, ""
    while j < len(src):
        c = src[j]
        if c == "\\":
            buf += src[j + 1:j + 2]
            j += 2
            continue
        if c == "`":
            parts.append(buf)
            return "".join(parts), j + 1
        if c == "$" and src[j + 1:j + 2] == "{":
            parts.append(buf + "{%d}" % n)
            buf, n, depth, j = "", n + 1, 1, j + 2
            while depth and j < len(src):
                if src[j] == "`":
                    _, j = template_key(src, j)
                    continue
                if src[j] in "'\"":
                    q, j = src[j], j + 1
                    while j < len(src) and src[j] != q:
                        j += 2 if src[j] == "\\" else 1
                    j += 1
                    continue
                depth += {"{": 1, "}": -1}.get(src[j], 0)
                j += 1
            continue
        buf += c
        j += 1
    return "".join(parts), j


# Lists whose labels are shown through L(...) at run time
LISTS = re.compile(r"export const (ROLES|TOPICS|GOALS|HOURS|WHEN|LOOKING_FOR|CURIOUS_GROUPS|MEETS|CONTACTS|CATEGORIES|NAV|REGION_NAME|STAGES)\s*=\s*([\[{][\s\S]*?[\]}]);")
# Messages saved in English and translated when shown
MESSAGES = re.compile(r"(?:text:|PASS_TEXT =|return|endChat\([^,]+,)\s*'([A-Z{][^'\n]{3,})'")


def visible(s: str) -> bool:
    # Skip ids like 'win', 'tw', 'ph-user' and icon names
    return bool(re.search(r"[A-Za-z]", s)) and (" " in s or s[:1].isupper() or s.startswith("{")) and not s.startswith("ph-")


def find_keys(root: Path = ROOT / "src") -> set[str]:
    keys: set[str] = set()
    for path in root.rglob("*.js"):
        if "locales" in path.parts:
            continue
        src = path.read_text("utf8")
        for m in re.finditer(r"(?<![\w$.])L`", src):
            keys.add(template_key(src, m.end() - 1)[0])
        for m in re.finditer(r"(?<![\w$.])L\('((?:[^'\\]|\\.)*)'\)", src):
            keys.add(m.group(1).replace("\\'", "'"))
        for m in LISTS.finditer(src):
            keys.update(s for s in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(2)) if visible(s))
        # Sample people's posts and replies are content, not interface text
        if path.name not in ("people.js", "sample-people.js"):
            for m in MESSAGES.finditer(src):
                keys.add(m.group(1))
    return {k for k in keys if re.search(r"[A-Za-z]", k) and k.strip() not in ("...", "…")}


# ---------- 2. zh.js ----------

LINE = re.compile(r'^  ("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$')


def read_zh(path: Path = ZH_FILE) -> dict[str, str]:
    out = {}
    for line in path.read_text("utf8").splitlines():
        m = LINE.match(line)
        if m:
            out[json.loads(m.group(1))] = json.loads(m.group(2))
    return out


def write_zh(zh: dict[str, str], path: Path = ZH_FILE) -> None:
    lines = [f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}," for k, v in sorted(zh.items(), key=lambda kv: kv[0].lower())]
    path.write_text(HEADER + "\nexport default {\n" + "\n".join(lines) + "\n};\n", "utf8")


# ---------- 3. Check an answer ----------

def acceptable(en: str, zh: str) -> bool:
    if not isinstance(zh, str) or not zh.strip():
        return False
    if sorted(re.findall(r"\{\d+\}", en)) != sorted(re.findall(r"\{\d+\}", zh)):
        return False  # a placeholder went missing or was invented
    if any(term in en and term not in zh for term in KEEP_ENGLISH):
        return False  # a product name was translated
    if re.findall(r"<[^>]+>", en) != re.findall(r"<[^>]+>", zh):
        return False
    return True


# ---------- 4. Ask the LLM ----------

def ask(texts: list[str], examples: dict[str, str]) -> dict[str, str]:
    shots = "\n".join(f"{json.dumps(k, ensure_ascii=False)} -> {json.dumps(v, ensure_ascii=False)}" for k, v in examples.items())
    user = f"Examples of the style already used:\n{shots}\n\nTranslate these:\n{json.dumps(texts, ensure_ascii=False, indent=0)}"
    if os.environ.get("ANTHROPIC_API_KEY"):
        import anthropic
        client = anthropic.Anthropic(timeout=120, max_retries=2)
        r = client.messages.create(
            model=os.environ.get("LLM_MODEL") or "claude-sonnet-5-5", max_tokens=8000, system=STYLE,
            messages=[{"role": "user", "content": user + "\n\nAnswer with the JSON object only."}],
        )
        raw = "".join(b.text for b in r.content if b.type == "text")
        raw = raw[raw.index("{"): raw.rindex("}") + 1]
    else:
        import openai
        client = openai.OpenAI(timeout=120, max_retries=2)
        model = os.environ.get("LLM_MODEL") or "gpt-5-mini"
        extra = {"reasoning_effort": "low"} if model.startswith(("gpt-5", "o1", "o3", "o4")) else {}
        r = client.chat.completions.create(
            model=model, max_completion_tokens=12000, response_format={"type": "json_object"},
            messages=[{"role": "system", "content": STYLE}, {"role": "user", "content": user}], **extra,
        )
        raw = r.choices[0].message.content
    return json.loads(raw).get("translations", {})


def main() -> int:
    zh = read_zh()
    keys = find_keys()
    # Slogans stay English on purpose: record them so they are not asked about again
    for s in SLOGANS + KEEP_ENGLISH:
        if s in keys and s not in zh:
            zh[s] = s
    missing = sorted(k for k in keys if k not in zh)
    print(f"Interface texts: {len(keys)}, in Chinese: {len(keys) - len(missing)}, missing: {len(missing)}")
    if not missing:
        write_zh(zh)
        return 0
    if not (os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")):
        print("No OPENAI_API_KEY or ANTHROPIC_API_KEY: not translating. Missing:\n  " + "\n  ".join(missing[:50]))
        write_zh(zh)
        return 0
    examples = {k: zh[k] for k in list(zh)[:: max(1, len(zh) // 20)][:20]}
    added, refused = 0, []
    for i in range(0, len(missing), 40):
        batch = missing[i:i + 40]
        try:
            got = ask(batch, examples)
        except Exception as err:  # keep going; the rest stay English for now
            print(f"Translation call failed: {err}")
            continue
        for en in batch:
            if acceptable(en, got.get(en)):
                zh[en] = got[en].strip()
                added += 1
            else:
                refused.append(en)
    write_zh(zh)
    print(f"Added {added} translations." + (f" Refused (kept in English for now): {refused}" if refused else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
