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


def test_llm_runner_reads_in_parallel_and_stops_after_failures():
    from crawler.run import LLMRunner

    class Fake:
        def __init__(self, fail):
            self.fail = fail

        def extract(self, raw, text):
            if self.fail:
                raise RuntimeError("model not found")
            return Extraction()

    class C:
        def save(self):
            return 0

    comps = [RawCompetition(id=f"bh-{i}", source="bhuntr", region="tw", kind="Art", name=f"C{i}", url="https://e.com") for i in range(30)]
    ok = LLMRunner(Fake(False), C(), workers=4).run([(c, "t") for c in comps])
    assert len(ok) == 30 and all(isinstance(v, Extraction) for v in ok.values())
    bad = LLMRunner(Fake(True), C(), workers=1)
    out = bad.run([(c, "t") for c in comps])
    assert bad.stopped and all(v is None for v in out.values())


def test_database_errors_say_why():
    import pytest
    store = SupabaseStore("https://abc.supabase.co", "sb_secret_x",
                          client=httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(400, text='{"message":"bad column"}'))))
    with pytest.raises(RuntimeError, match="bad column"):
        store.save([{"competition": {"id": "dp-1"}, "tracks": [], "issues": []}])


def test_near_miss_categories_and_long_names_are_fixed_not_rejected():
    from crawler.extract.schema import Listing
    base = {"region": "tw", "en": {"name": "N"}, "zh": {"name": "N"}}
    assert Listing.model_validate({**base, "category": "music"}).category == "performance"
    assert Listing.model_validate({**base, "category": "Photography"}).category == "film_photo"
    assert Listing.model_validate({**base, "category": "something else"}).category == "other"
    long = Listing.model_validate({**base, "category": "art", "en": {"name": "x" * 400, "organizer": "y" * 400}})
    assert len(long.en.name) <= 200 and len(long.en.organizer) <= 200


def test_competitions_a_source_dropped_are_hidden_only_for_sources_read():
    sent = []
    client = httpx.Client(transport=httpx.MockTransport(lambda req: sent.append(req) or httpx.Response(204)))
    store = SupabaseStore("https://x.supabase.co", "sb_secret_abc", client)
    store.unlist_missing(["devpost", "mlh"], ["dp-1", "mlh-2"])
    req = sent[0]
    assert req.method == "PATCH" and json.loads(req.content) == {"listed": False}
    assert req.url.params["source"] == "in.(devpost,mlh)"
    assert req.url.params["id"] == "not.in.(dp-1,mlh-2)"
    store.unlist_missing([], ["dp-1"])
    assert len(sent) == 1, "no source read: nothing is hidden"


def test_devpost_who_can_participate_survives_the_menu():
    from crawler.extract.candidates import relevant
    from crawler.sources.devpost import strip_chrome, who_can_enter
    page = ("Join a hackathon\n Log in\n Sign up\n Overview\n FUSE Society Blueprint 2026\n This hackathon has ended\n"
            " Who can participate\n Ages 14 to 18 only\n High school students only\n"
            " Companies/professional organizations excluded from participation\n View full rules\n"
            " Each team will submit a solution.")
    text = strip_chrome(page)
    assert "Log in" not in text and "Join a hackathon" not in text
    assert "High school students only" in relevant(text)
    who = who_can_enter(page)
    assert who.page == "who can participate"
    assert who.text.split("\n")[:2] == ["Ages 14 to 18 only", "High school students only"]


def test_long_pages_keep_eligibility_and_team_size_first():
    # A long list of tracks (each with 組) comes before the rules; the rules must still get in
    tracks = "".join(f"第{i}組說明：資訊應用、智慧製造、區塊鏈、物聯網、雲端應用、行動支付、資訊安全、電子商務等相關應用與服務。" for i in range(80))
    page = "活動簡介本競賽分為多個組別。" + tracks + "參賽資格大專校院在學學生都可參加。每隊學生不超過8人，另需有1-2名學校指導老師。國籍限制除國際交流組外，預設為臺灣地區學生。"
    text = relevant(page)
    assert len(text) <= 4000
    assert "每隊學生不超過8人" in text and "參賽資格" in text and "國籍限制" in text
    assert text.index("第0組") < text.index("參賽資格"), "still in page order"
    short = "我們歡迎組隊。每隊 2 至 5 人。"
    assert relevant(short) == "我們歡迎組隊。 每隊 2 至 5 人。", "short pages read as before"
