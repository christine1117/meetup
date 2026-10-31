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

# Answers are remembered by the page text alone. A new model, or new wording of the instructions,
# applies to pages read from now on: nothing is read again just because of it. To read every page
# again, run the workflow with "Read every competition again" (or change ANSWERS).
ANSWERS = "openai|gpt-5-mini|5"

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
   Prefer one sentence. Do not join sentences from different places and do not add punctuation.
   min and max must come from that quote: stated there, or simple arithmetic of the people it counts
   ("1名組長及1~5名組員" is min 2, max 6; the advisor is not counted). "Solo or in a team of up to 4"
   and "個人或兩人以下團體" mean min 1. Never give a number the quote does not support, and never count
   entries, works, prizes or places as people ("僅得繳交一件作品" says nothing about team size).
8. individual_allowed: true if one person may enter alone (個人或團隊, individually or in teams);
   false if a team is required (僅接受團體參賽, team required).
   individual_only: true only if teams are NOT allowed at all (限個人參賽, individuals only, solo only).
   "僅接受團體參賽" means teams only: individual_only is false.
8b. teams_allowed: true only if the text plainly says people may enter as a team (組隊, 團體報名,
   每隊, teams of, team members). Do not assume teams are allowed. If the text says there is no limit
   on team size (團隊人數無上限, 人數不限), set unlimited true on that rule and leave max null.
   Different plans or tracks with different sizes are separate rules (for example
   "團隊人數無限制，若使用訂閱方案則為最多5人" is one rule with unlimited true and one rule,
   track "訂閱方案", with max 5).
9. needs_review is only about team size: set it when the size rules are ambiguous or contradict each
   other (for example the overview says 2–4 and the rules say 3–5). Do NOT set it because a size is
   simply not stated (use null), or because of age, eligibility or other details.
10. eligibility: who may enter. That means school level (university, graduate, high school...), age,
    nationality or residency, profession, and conditions such as a required school advisor. It is
    NOT the competition's purpose, topic or theme ("鼓勵參賽者運用資訊科技" is not eligibility).
    If it differs by track, cover each group briefly in one sentence (for example
    "大專校院及高中職在學生，每隊需 1–2 名指導老師；國際交流組限外國大專生"). Under 200 characters,
    in the language of the source, with an exact quote as evidence. Leave it null when the text does
    not say who may enter.
11. listing: pick one category, decide the region, and describe the competition in English (en) and in
    Traditional Chinese as used in Taiwan (zh): name, organizer, one-sentence summary, eligibility,
    up to 5 short tags. en is always written in English and zh always in Traditional Chinese, whatever
    the language of the source: translate, never copy Chinese into en. If eligibility is given above,
    give it in both languages too. Write naturally, like a person from that place would, not word for word.
    Keep brand and proper names as they are. For each team rule also give the track name in both
    languages (track_en, track_zh).
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


def cache_key(text: str) -> str:
    return "llm:" + hashlib.sha256(f"{ANSWERS}|{text}".encode()).hexdigest()[:32]


def user_message(comp: RawCompetition, text: str) -> str:
    facts = [f"Competition: {comp.name}", f"Organizer: {comp.organizer}", f"Listed on: {comp.source}"]
    if comp.where:
        facts.append(f"Where: {comp.where}")
    if comp.tags:
        facts.append(f"Tags: {', '.join(comp.tags)}")
    if comp.summary:
        facts.append(f"Summary: {comp.summary}")
    return "\n".join(facts) + f"\n\nSource text:\n{text}"


class Extractor:
    """Shared by every provider: cache the answer, and let Pydantic check its shape."""

    provider = "base"

    def __init__(self, model: str, cache=None, effort: str = "low", reread: bool = False):
        self.model, self.cache, self.calls, self.effort = model, cache, 0, effort
        self.reread = reread  # True: ask again even when the answer is remembered

    def call(self, system: str, tool: dict, user: str, effort: str) -> Any:
        """One forced tool call; the provider's raw answer (dict or JSON text)."""
        raise NotImplementedError

    def ask(self, comp: RawCompetition, text: str) -> Any:
        return self.call(SYSTEM, TOOL, user_message(comp, text), self.effort)

    def extract(self, comp: RawCompetition, text: str) -> Extraction:
        key = cache_key(text)
        if self.cache is not None and not self.reread:
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

    def __init__(self, api_key: str, model: str, cache=None, effort: str = "low", reread: bool = False):
        super().__init__(model, cache, effort, reread)
        import anthropic  # only needed when this provider is used

        self.client = anthropic.Anthropic(api_key=api_key, timeout=90, max_retries=2)

    def call(self, system, tool, user, effort):
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            tools=[tool],
            tool_choice={"type": "tool", "name": tool["name"]},
            messages=[{"role": "user", "content": user}],
        )
        return next(b for b in response.content if b.type == "tool_use").input


class OpenAIExtractor(Extractor):
    """OpenAI API. Needs OPENAI_API_KEY. The same tool schema, sent as a function."""

    provider = "openai"

    def __init__(self, api_key: str, model: str, cache=None, effort: str = "low", reread: bool = False):
        super().__init__(model, cache, effort, reread)
        import openai  # only needed when this provider is used

        # The flex tier can take minutes to answer: a long timeout
        self.client = openai.OpenAI(api_key=api_key, timeout=600, max_retries=2)
        self.flex_ok = True

    def call(self, system, tool, user, effort):
        reasoning = self.model.startswith(("gpt-5", "o1", "o3", "o4"))
        request = dict(
            model=self.model,
            max_completion_tokens=16000,
            # Reasoning models think before answering; that thinking is billed like the answer
            **({"reasoning_effort": effort} if reasoning else {}),
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            tools=[{"type": "function", "function": {"name": tool["name"], "description": tool["description"],
                                                     "parameters": tool["input_schema"]}}],
            tool_choice={"type": "function", "function": {"name": tool["name"]}},
        )
        response = None
        if reasoning and self.flex_ok:
            # Flex: the same model and answer at about half the price, only slower (fine for a nightly crawl)
            try:
                response = self.client.chat.completions.create(**request, service_tier="flex")
            except Exception as err:
                if "service_tier" in str(err) or "flex" in str(err).lower():
                    self.flex_ok = False  # not offered for this model: stop trying
                response = None           # busy or not offered: ask again at the normal price
        if response is None:
            response = self.client.chat.completions.create(**request)
        choice = response.choices[0]
        if not choice.message.tool_calls:
            raise ValueError(f"no answer in the expected shape (finish_reason={choice.finish_reason})")
        return choice.message.tool_calls[0].function.arguments  # JSON text


DEFAULT_MODEL = {"anthropic": "claude-sonnet-5-5", "openai": "gpt-5-mini"}


def make_extractor(cfg, cache=None) -> Extractor | None:
    """Claude if ANTHROPIC_API_KEY is set, otherwise OpenAI if OPENAI_API_KEY is set, otherwise none."""
    if cfg.anthropic_api_key:
        return ClaudeExtractor(cfg.anthropic_api_key, cfg.llm_model or DEFAULT_MODEL["anthropic"], cache, cfg.llm_effort, cfg.llm_reread)
    if cfg.openai_api_key:
        return OpenAIExtractor(cfg.openai_api_key, cfg.llm_model or DEFAULT_MODEL["openai"], cache, cfg.llm_effort, cfg.llm_reread)
    return None
