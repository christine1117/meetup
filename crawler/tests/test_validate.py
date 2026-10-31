"""The validator, one test per row of the checklist."""

from crawler.extract.schema import Eligibility, Extraction, PageText, RawCompetition, TeamRule
from crawler.extract.validate import decide, overall, quoted


def comp(**kw):
    base = dict(id="bh-x1", source="bhuntr", region="tw", kind="Design", name="Test", url="https://bhuntr.com/tw/competitions/x1",
                pages=[PageText(page="description", text="placeholder")])
    return RawCompetition(**{**base, **kw})


def rule(evidence, **kw):
    return TeamRule(evidence=evidence, **kw)


def test_min_greater_than_max_is_an_error():
    src = "每隊5人，最多2人"
    d = decide(comp(), Extraction(team_rules=[rule("每隊5人，最多2人", min_members=5, max_members=2)]), src)
    assert "min_greater_than_max" in [i.code for i in d.issues]
    assert d.tracks == []


def test_only_a_maximum_keeps_min_null():
    src = "每組最多5人。"
    d = decide(comp(), Extraction(team_rules=[rule("每組最多5人", max_members=5)]), src)
    assert d.status == "published" and d.listed
    assert d.tracks[0].min is None and d.tracks[0].max == 5
    assert overall(d.tracks) == {"min": None, "max": 5, "unlimited": False}


def test_tracks_are_kept_apart():
    src = "高中組每隊2至4人；大專組每隊3至5人。"
    ex = Extraction(team_rules=[rule("高中組每隊2至4人", track="高中組", min_members=2, max_members=4),
                                rule("大專組每隊3至5人", track="大專組", min_members=3, max_members=5)])
    d = decide(comp(), ex, src)
    assert [(t.name, t.min, t.max) for t in d.tracks] == [("高中組", 2, 4), ("大專組", 3, 5)]
    assert overall(d.tracks) == {"min": 2, "max": 5, "unlimited": False}


def test_conflicting_pages_go_to_review_without_sizes():
    src = "[overview] Teams of 2-4 people. [rules] Each team has 3 to 5 members."
    ex = Extraction(team_rules=[rule("Teams of 2-4 people", min_members=2, max_members=4, page="overview"),
                                rule("Each team has 3 to 5 members", min_members=3, max_members=5, page="rules")])
    d = decide(comp(), ex, src)
    assert d.status == "review" and d.listed
    assert "conflicting_sources" in [i.code for i in d.issues]
    assert d.tracks == []


def test_mentors_are_kept_apart():
    src = "每隊最多 5 名學生及 1 名指導老師。"
    d = decide(comp(), Extraction(team_rules=[rule("每隊最多 5 名學生及 1 名指導老師", max_members=5, mentors_max=1)]), src)
    assert d.tracks[0].max == 5 and d.tracks[0].mentors == 1


def test_quote_not_on_the_page_is_not_published():
    src = "歡迎全國大專學生參加。"
    d = decide(comp(), Extraction(team_rules=[rule("每隊3至5人", min_members=3, max_members=5)]), src)
    assert "evidence_not_found" in [i.code for i in d.issues]
    assert not d.listed and d.tracks == []


def test_quotes_match_across_full_and_half_width():
    assert quoted("每隊3~5人", "參賽資格：每隊３～５人，可跨校")
    assert quoted("teams of up to 4", "Teams  of up to 4 people")


def test_unsure_answers_are_not_published():
    src = "可以個人或最多8人的團隊形式參賽"
    ex = Extraction(team_rules=[rule("可以個人或最多8人的團隊形式參賽", max_members=8, individual_allowed=True)],
                    needs_review=True, review_reason="unclear")
    d = decide(comp(), ex, src)
    assert d.status == "review" and d.tracks == []


def test_alone_or_team_reads_as_one_to_eight():
    src = "可以個人或最多8人的團隊形式參賽，強烈鼓勵跨領域合作。"
    d = decide(comp(), Extraction(team_rules=[rule("可以個人或最多8人的團隊形式參賽", max_members=8, individual_allowed=True)]), src)
    assert d.status == "published"
    assert overall(d.tracks) == {"min": 1, "max": 8, "unlimited": False}


def test_individual_only_is_excluded():
    d = decide(comp(), Extraction(individual_only=True), "限個人參賽")
    assert d.status == "excluded" and not d.listed


def test_no_team_rules_is_excluded_unless_a_hackathon():
    assert decide(comp(), Extraction(), "徵文比賽").status == "excluded"
    hack = comp(id="dp-1", source="devpost", region="intl", team_by_default=True)
    assert decide(hack, Extraction(), "Build anything").listed


def test_not_read_yet():
    assert decide(comp(), None, "text").status == "pending"
    assert not decide(comp(), None, "text").listed
    hack = comp(id="mlh-x", source="mlh", region="intl", team_by_default=True, pages=[])
    assert decide(hack, None, "").status == "published"


def test_eligibility_needs_its_quote():
    src = "參賽資格：全國大專院校在學學生。每隊2至4人。"
    ex = Extraction(team_rules=[rule("每隊2至4人", min_members=2, max_members=4)],
                    eligibility=Eligibility(summary="全國大專院校在學學生", evidence="全國大專院校在學學生"))
    assert decide(comp(), ex, src).eligibility == "全國大專院校在學學生"
    ex.eligibility = Eligibility(summary="高中生", evidence="限高中生參加")
    d = decide(comp(), ex, src)
    assert d.eligibility is None and "eligibility_evidence_not_found" in [i.code for i in d.issues]


# Real cases from the first LLM run
def test_quote_joined_from_two_places_still_counts_if_every_piece_is_on_the_page():
    page = "Each team must include 2–4 participants. This challenge is open to everyone. Each team may work with one mentor or faculty advisor."
    assert quoted("Each team must include 2–4 participants . Each team may work with one mentor or faculty advisor", page)
    assert quoted("Team required: 2 to 3 members.", "Team required: 2 to 3 members Companies excluded")
    assert not quoted("Each team must include 2–6 participants. Each team may work with one mentor", page)


def test_participants_and_mentors_in_one_sentence():
    src = "可跨校組隊參加，每隊組員學生人數2-6名，指導老師1-2名。"
    d = decide(comp(), Extraction(team_rules=[rule("每隊組員學生人數2-6名，指導老師1-2名", min_members=2, max_members=6, mentors_max=2)]), src)
    assert d.status == "published" and (d.tracks[0].min, d.tracks[0].max, d.tracks[0].mentors) == (2, 6, 2)


def test_team_only_is_never_excluded_as_individual_only():
    src = "參賽資格全國大專校院在學學生可報名。僅接受團體參賽，每組以2至5人為限，每位學生可加入多個團體。"
    ex = Extraction(individual_only=True, team_rules=[rule("僅接受團體參賽，每組以2至5人為限", min_members=2, max_members=5, individual_allowed=False)])
    d = decide(comp(), ex, src)
    assert d.listed and overall(d.tracks) == {"min": 2, "max": 5, "unlimited": False}


def test_overall_size_with_an_individual_track_and_an_open_team_track():
    from crawler.extract.schema import Track
    tracks = [Track(name="個人組", max=1, solo=True, evidence="a"), Track(name="團體組", min=2, max=None, evidence="b")]
    assert overall(tracks) == {"min": 1, "max": None, "unlimited": False}
    assert overall([Track(name=None, max=4, evidence="c")]) == {"min": None, "max": 4, "unlimited": False}


def test_long_eligibility_is_cut_not_rejected():
    ex = Extraction.model_validate({"eligibility": {"summary": "x" * 500, "evidence": "quote"}})
    assert len(ex.eligibility.summary) <= 300


def test_listing_category_region_and_languages_reach_the_website():
    from crawler.extract.schema import Listing, Texts
    from crawler.run import listing_record
    src = "參賽資格：全國大專院校學生。每隊2至4人。"
    lst = Listing(category="design", region="tw",
                  en=Texts(name="Tsinghua Mask Teaching Award", organizer="National Tsing Hua University", summary="Teaching awards."),
                  zh=Texts(name="清華光罩教學獎", organizer="國立清華大學", summary="教學獎項。"))
    ex = Extraction(team_rules=[rule("每隊2至4人", min_members=2, max_members=4, track_en=None)], listing=lst)
    c = comp(region="intl")
    rec = listing_record(c, decide(c, ex, src))
    assert rec["region"] == "tw", "the LLM's region wins over the old keyword guess"
    assert rec["category"] == "design" and rec["kind"] == "Design"
    assert rec["i18n"]["en"]["name"] == "Tsinghua Mask Teaching Award"
    assert rec["tracks"][0]["max"] == 4


def test_no_limit_on_team_size():
    src = "團隊人數無限制，若使用訂閱方案則為最多5人。"
    ex = Extraction(teams_allowed=True, team_rules=[rule("團隊人數無限制", unlimited=True),
                                                     rule("若使用訂閱方案則為最多5人", track="訂閱方案", max_members=5)])
    d = decide(comp(), ex, src)
    assert d.listed and overall(d.tracks)["unlimited"] is True
    assert [(t.name, t.max) for t in d.tracks] == [(None, None), ("訂閱方案", 5)]


def test_not_listed_unless_the_text_says_teams_can_enter():
    src = "全民皆可報名，每人限提交1件作品。"
    d = decide(comp(), Extraction(team_rules=[rule("全民皆可報名", individual_allowed=True)]), src)
    assert not d.listed and "no_team_rules" in [i.code for i in d.issues]
    d = decide(comp(), Extraction(teams_allowed=True, team_rules=[]), "可個人或組隊參賽")
    assert d.listed and d.tracks == []


def test_what_the_llm_understood_is_kept_when_its_quote_is_on_the_page():
    # Understanding the wording is the LLM's job; the code only checks the quote is really there
    regtech = "每隊需由1名指導老師、1名組長及1~5名組員組成，即每隊伍之組成最少為2人。"
    ex = Extraction(team_rules=[rule(regtech, min_members=2, max_members=6, mentors_max=1)])
    d = decide(comp(), ex, regtech)
    assert d.status == "published" and (d.tracks[0].min, d.tracks[0].max, d.tracks[0].mentors) == (2, 6, 1)
    d = decide(comp(), ex, "這頁沒有寫人數")
    assert d.tracks == [] and d.issues[0].code == "evidence_not_found"
