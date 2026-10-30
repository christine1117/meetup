"""Step 2: an LLM reads the candidate paragraphs and returns the rules.

Works with Claude (ANTHROPIC_API_KEY) or OpenAI (OPENAI_API_KEY).
The model must answer through a tool whose input schema is the Pydantic
Extraction model, so the answer always has the same shape. Answers are cached
by (model, prompt version, text), so a page is only read again when it changes.
"""

from __future__ import annotations

import copy
import hashlib
from typing import Any, Protocol

from .schema import Extraction, RawCompetition

PROMPT_VERSION = "1"

SYSTEM = """You read competition pages and extract the allowed number of participants per team.

Rules:
1. Extract only team-size requirements: how many participants may be on one team.
2. Return the minimum and the maximum separately.
3. Use null when a bound is not explicitly stated. "Up to 5 people" means max 5 and min null.
   Do not invent a minimum.
4. Do not confuse team size with age, prize counts, mentors or teachers, judges, the number of
   teams accepted, sign-up caps, or how many entries one person may submit.
5. Mentors, advisors and teachers (指導老師) go in mentors_max, never in min or max.
   "最多 5 名學生及 1 名指導老師" means max_members 5 and mentors_max 1.
6. If different tracks or categories (組別) have different rules, return one rule per track.
7. Every rule needs evidence: an exact quote copied character for character from the source text.
8. If one person may enter alone (個人或團隊, individually or in teams), set individual_allowed to true.
   If the text says individuals only, set individual_only to true.
9. If the text is ambiguous or contradicts itself (for example the overview and the rules give
   different sizes), set needs_review to true and say why.
10. Also give a one-sentence summary of who can enter (eligibility), in the language of the source,
    with an exact quote as evidence, when the text says.
Return nothing that is not supported by the text."""


class LLM(Protocol):
    def extract(self, comp: RawCompetition, text: str) -> Extraction: ...


def inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Pydantic puts nested models in $defs; the tool schema is clearer with them inlined."""
    defs = schema.get("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return walk(copy.deepcopy(defs[node["$ref"].split("/")[-1]]))
            return {k: walk(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [walk(x) for x in node]
        return node

    return walk(schema)


TOOL = {
    "name": "record_team_rules",
    "description": "Record the team-size rules and eligibility found in the competition text.",
    "input_schema": inline_refs(Extraction.model_json_schema()),
}


def cache_key(provider: str, model: str, text: str) -> str:
    return "llm:" + hashlib.sha256(f"{provider}|{model}|{PROMPT_VERSION}|{text}".encode()).hexdigest()[:32]


def user_message(comp: RawCompetition, text: str) -> str:
    return f"Competition: {comp.name}\nOrganizer: {comp.organizer}\n\nSource text:\n{text}"


class Extractor:
    """Shared by every provider: cache the answer, and let Pydantic check its shape."""

    provider = "base"

    def __init__(self, model: str, cache=None):
        self.model, self.cache, self.calls = model, cache, 0

    def ask(self, comp: RawCompetition, text: str) -> Any:  # the provider's raw answer (dict or JSON text)
        raise NotImplementedError

    def extract(self, comp: RawCompetition, text: str) -> Extraction:
        key = cache_key(self.provider, self.model, text)
        if self.cache is not None:
            saved = self.cache.get(key, max_age_days=180)
            if saved is not None:
                return Extraction.model_validate(saved)
        raw = self.ask(comp, text)
        self.calls += 1
        result = Extraction.model_validate_json(raw) if isinstance(raw, str) else Extraction.model_validate(raw)
        if self.cache is not None:
            self.cache.set(key, result.model_dump())
        return result


class ClaudeExtractor(Extractor):
    """Anthropic API. Needs ANTHROPIC_API_KEY."""

    provider = "anthropic"

    def __init__(self, api_key: str, model: str, cache=None):
        super().__init__(model, cache)
        import anthropic  # only needed when this provider is used

        self.client = anthropic.Anthropic(api_key=api_key)

    def ask(self, comp, text):
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
            tools=[TOOL],
            tool_choice={"type": "tool", "name": TOOL["name"]},
            messages=[{"role": "user", "content": user_message(comp, text)}],
        )
        return next(b for b in response.content if b.type == "tool_use").input


class OpenAIExtractor(Extractor):
    """OpenAI API. Needs OPENAI_API_KEY. The same tool schema, sent as a function."""

    provider = "openai"

    def __init__(self, api_key: str, model: str, cache=None):
        super().__init__(model, cache)
        import openai  # only needed when this provider is used

        self.client = openai.OpenAI(api_key=api_key)

    def ask(self, comp, text):
        response = self.client.chat.completions.create(
            model=self.model,
            max_completion_tokens=4000,
            messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_message(comp, text)}],
            tools=[{"type": "function", "function": {"name": TOOL["name"], "description": TOOL["description"],
                                                     "parameters": TOOL["input_schema"]}}],
            tool_choice={"type": "function", "function": {"name": TOOL["name"]}},
        )
        return response.choices[0].message.tool_calls[0].function.arguments  # JSON text


DEFAULT_MODEL = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-5-mini"}


def make_extractor(cfg, cache=None) -> Extractor | None:
    """Claude if ANTHROPIC_API_KEY is set, otherwise OpenAI if OPENAI_API_KEY is set, otherwise none."""
    if cfg.anthropic_api_key:
        return ClaudeExtractor(cfg.anthropic_api_key, cfg.llm_model or DEFAULT_MODEL["anthropic"], cache)
    if cfg.openai_api_key:
        return OpenAIExtractor(cfg.openai_api_key, cfg.llm_model or DEFAULT_MODEL["openai"], cache)
    return None
