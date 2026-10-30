"""Candidate paragraphs, the LLM step (with a fake client) and the database store (with a fake server)."""

import json
from types import SimpleNamespace

import httpx

from crawler.extract import llm as llm_mod
from crawler.extract.candidates import label, relevant
from crawler.extract.schema import Extraction, PageText, Published, RawCompetition
from crawler.store.supabase_store import SupabaseStore


def test_candidates_keep_team_sentences_and_their_neighbours():
    text = "本競賽鼓勵創新。歡迎全球建築師參與。可以個人或最多8人的團隊形式參賽。報名費50美元。頒獎典禮在杜拜舉行。"
    kept = relevant(text)
    assert "最多8人的團隊" in kept and "歡迎全球建築師參與" in kept and "報名費50美元" in kept
    assert "頒獎典禮" not in kept
    assert label([PageText(page="rules", text="Teams of 2-4.")]) == "[rules] Teams of 2-4."


def test_tool_schema_has_no_refs():
    assert "$ref" not in json.dumps(llm_mod.TOOL["input_schema"])
    assert llm_mod.TOOL["input_schema"]["properties"]["team_rules"]["items"]["properties"]["evidence"]


class FakeMessages:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input=self.answer)])


class FakeCache(dict):
    def get(self, key, **kw):
        return super().get(key)

    def set(self, key, value, mod=None):
        self[key] = value


def test_llm_answer_is_checked_by_pydantic_and_cached():
    answer = {"team_rules": [{"max_members": 8, "individual_allowed": True, "evidence": "可以個人或最多8人的團隊形式參賽"}]}
    ex = llm_mod.ClaudeExtractor.__new__(llm_mod.ClaudeExtractor)
    llm_mod.Extractor.__init__(ex, "test-model", FakeCache())
    ex.client = SimpleNamespace(messages=FakeMessages(answer))
    comp = RawCompetition(id="bh-a", source="bhuntr", region="tw", kind="Design", name="Dewan", url="https://example.com")
    got = ex.extract(comp, "text")
    assert isinstance(got, Extraction) and got.team_rules[0].max_members == 8
    sent = ex.client.messages.calls[0]
    assert sent["tool_choice"] == {"type": "tool", "name": "record_team_rules"}
    ex.extract(comp, "text")
    assert ex.calls == 1, "the second time comes from the cache"


def test_openai_answer_goes_through_the_same_checks():
    args = json.dumps({"team_rules": [{"min_members": 2, "max_members": 4, "evidence": "每隊2至4人"}]}, ensure_ascii=False)
    calls = []

    def create(**kw):
        calls.append(kw)
        call = SimpleNamespace(function=SimpleNamespace(arguments=args))
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(tool_calls=[call]))])

    ex = llm_mod.OpenAIExtractor.__new__(llm_mod.OpenAIExtractor)
    llm_mod.Extractor.__init__(ex, "test-model", FakeCache())
    ex.client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    comp = RawCompetition(id="bh-b", source="bhuntr", region="tw", kind="Tech", name="T", url="https://example.com")
    got = ex.extract(comp, "每隊2至4人")
    assert (got.team_rules[0].min_members, got.team_rules[0].max_members) == (2, 4)
    assert calls[0]["tool_choice"]["function"]["name"] == "record_team_rules"


def test_provider_is_picked_from_the_keys():
    from crawler.config import Config
    base = dict(supabase_url=None, supabase_service_key=None, llm_model=None)
    assert llm_mod.make_extractor(Config(anthropic_api_key=None, openai_api_key=None, **base)) is None
    picked = llm_mod.make_extractor(Config(anthropic_api_key=None, openai_api_key="sk-test", **base))
    assert picked.provider == "openai" and picked.model == "gpt-5-mini"


def test_bad_llm_answers_are_rejected():
    import pytest
    with pytest.raises(Exception):
        Extraction.model_validate({"team_rules": [{"max_members": 500, "evidence": "x y"}]})
    with pytest.raises(Exception):
        Extraction.model_validate({"team_rules": [{"max_members": 4}]})  # no evidence


def test_published_contract():
    import pytest
    ok = dict(id="dp-1", source="devpost", region="intl", kind="Hackathon", name="H", url="https://x.dev", team={"min": None, "max": 4})
    Published.model_validate(ok)
    with pytest.raises(Exception):
        Published.model_validate({**ok, "url": "javascript:alert(1)"})
    with pytest.raises(Exception):
        Published.model_validate({**ok, "team": {"min": None, "max": 1}})


def test_both_kinds_of_supabase_keys():
    assert "Authorization" in SupabaseStore("https://abc.supabase.co", "eyJhbGciOi.legacy").headers
    new = SupabaseStore("https://abc.supabase.co", "sb_secret_abc123").headers
    assert new["apikey"] == "sb_secret_abc123" and "Authorization" not in new


def test_supabase_store_sends_rows():
    seen = []

    def handler(request):
        seen.append((request.method, request.url.path, request.headers.get("prefer")))
        return httpx.Response(201)

    store = SupabaseStore("https://abc.supabase.co", "service-key", client=httpx.Client(transport=httpx.MockTransport(handler)))
    store.save([{"competition": {"id": "dp-1"}, "tracks": [{"track": None, "max_members": 4, "evidence": "q"}], "issues": []}])
    assert ("POST", "/rest/v1/competitions", "resolution=merge-duplicates,return=minimal") in seen
    assert ("DELETE", "/rest/v1/competition_team_rules", None) in seen
    assert any(p == "/rest/v1/competition_team_rules" and m == "POST" for m, p, _ in seen)
