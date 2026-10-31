"""The shapes of the data, checked by Pydantic.

RawCompetition  what a source gives us before any reading of the rules
TeamRule        one team-size rule the LLM found, with an exact quote as evidence
Extraction      everything the LLM returns for one competition (its JSON schema
                is sent to the model, so the model has to answer in this shape)
Track / Decision  what the validator lets through, ready to publish
"""

from __future__ import annotations

import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Source = Literal["devpost", "mlh", "bhuntr"]
Region = Literal["tw", "intl"]
Status = Literal["published", "review", "excluded", "pending"]
Category = Literal["hackathon", "tech", "startup", "design", "film_photo", "writing", "art", "performance",
                   "science", "social_impact", "sports", "other"]
CATEGORY_HELP = (
    "hackathon: build something in a set time, usually software; tech: coding, AI, data, engineering, robotics; "
    "startup: business plans, pitching, marketing; design: product, graphic, interior, architecture; "
    "film_photo: video, film, photography, animation; writing: essays, fiction, scripts, poetry; "
    "art: drawing, painting, illustration, comics, crafts; performance: music, singing, dance, theatre; "
    "science: research, maths, science fairs, quizzes; social_impact: public good, sustainability, community, policy; "
    "sports: races, sports, e-sports, board games; other: anything else."
)


class PageText(BaseModel):
    """Text from one page of a competition: overview, rules, description, ..."""

    page: str
    text: str


class RawCompetition(BaseModel):
    id: str = Field(pattern=r"^[a-z]+-[\w-]+$")
    source: Source
    region: Region
    kind: str
    name: str = Field(min_length=1, max_length=200)
    organizer: str = Field("", max_length=200)
    url: str
    start: Optional[str] = None
    end: Optional[str] = None
    deadline: Optional[str] = None
    where: str = Field("", max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=8)
    prize: str = Field("", max_length=60)
    summary: str = Field("", max_length=200)
    # Hackathon platforms: teams are the norm even when the size is not written down
    team_by_default: bool = False
    pages: list[PageText] = Field(default_factory=list)

    @field_validator("url")
    @classmethod
    def http_only(cls, v: str) -> str:
        # Only http(s) links ever reach the website, never javascript: or data:
        if not re.match(r"^https?://", v, re.I):
            raise ValueError("url must start with http:// or https://")
        return v


class TeamRule(BaseModel):
    track: Optional[str] = Field(
        None,
        description="The track or category this rule is for (e.g. 高中組, Student track), "
        "or null when the rule applies to everyone.",
    )
    min_members: Optional[int] = Field(
        None, ge=1, le=100,
        description="Fewest participants per team, only if the text states a minimum. "
        "Never count mentors, advisors or teachers. Null when not stated.",
    )
    max_members: Optional[int] = Field(
        None, ge=1, le=100,
        description="Most participants per team, only if the text states a maximum. "
        "Never count mentors, advisors or teachers. Null when not stated.",
    )
    mentors_max: Optional[int] = Field(
        None, ge=0, le=20,
        description="Mentors, advisors or teachers (指導老師) allowed per team, kept apart "
        "from participants. Null when not stated.",
    )
    individual_allowed: Optional[bool] = Field(
        None, description="True if one person may enter alone, false if a team is required, null if not stated."
    )
    unlimited: bool = Field(
        False, description="True only if the text says there is no limit on team size (團隊人數無上限, 人數不限, no limit on team size)."
    )
    evidence: str = Field(
        ..., min_length=2,
        description="An exact quote copied character for character from the source text that states this rule.",
    )
    page: Optional[str] = Field(None, description="Which page the quote comes from, as labelled in the source text.")
    track_en: Optional[str] = Field(None, description="The track name in English (null if no track).")
    track_zh: Optional[str] = Field(None, description="The track name in Traditional Chinese as used in Taiwan (null if no track).")


class Eligibility(BaseModel):
    summary: str = Field(
        ..., min_length=2, max_length=300,
        description="Who may enter (school level, age, nationality, profession, required advisors), covering each "
                    "track briefly, in one sentence under 200 characters, in the same language as the source. "
                    "Never the competition's purpose or topic.",
    )

    @field_validator("summary", mode="before")
    @classmethod
    def shorten(cls, v):
        # A long summary is cut, not rejected: the facts are still checked through the quote
        return v if not isinstance(v, str) or len(v) <= 300 else v[:299].rstrip() + "…"
    evidence: str = Field(..., min_length=2, description="An exact quote from the source text about who can enter.")


def _cut(n: int):
    def cut(v):
        return v if not isinstance(v, str) or len(v) <= n else v[: n - 1].rstrip() + "…"
    return cut


class Texts(BaseModel):
    """The competition described in one language: en is always English and zh always Traditional
    Chinese, whatever the language of the source."""

    name: str = Field(..., min_length=1, max_length=200, description="Its name. Keep brand and proper names as they are; translate descriptive titles.")
    organizer: str = Field("", max_length=200, description="The organizer, by its official name in this language if it has one, otherwise translated.")
    summary: str = Field("", max_length=300, description="One sentence (under 140 characters) on what the competition is about.")
    eligibility: Optional[str] = Field(None, max_length=300, description="Who may enter (school level, age, nationality...), one sentence covering each track briefly; never the purpose. Null if the text does not say.")
    tags: list[str] = Field(default_factory=list, max_length=6, description="Up to 5 short topic tags.")

    @field_validator("summary", "eligibility", mode="before")
    @classmethod
    def shorten(cls, v):
        return _cut(300)(v)

    @field_validator("name", "organizer", mode="before")
    @classmethod
    def shorten_names(cls, v):
        return _cut(200)(v)

    @field_validator("tags", mode="before")
    @classmethod
    def few_tags(cls, v):
        return [str(t)[:40] for t in v][:6] if isinstance(v, list) else v


# Words an LLM sometimes uses instead of the listed categories
CATEGORY_SYNONYMS = {
    "music": "performance", "dance": "performance", "theatre": "performance", "theater": "performance", "singing": "performance",
    "photography": "film_photo", "photo": "film_photo", "film": "film_photo", "video": "film_photo", "animation": "film_photo",
    "business": "startup", "entrepreneurship": "startup", "marketing": "startup", "pitch": "startup",
    "ai": "tech", "programming": "tech", "coding": "tech", "engineering": "tech", "robotics": "tech", "data": "tech",
    "architecture": "design", "interior": "design", "product": "design", "fashion": "design",
    "literature": "writing", "poetry": "writing", "essay": "writing",
    "painting": "art", "illustration": "art", "comics": "art", "crafts": "art",
    "sport": "sports", "esports": "sports", "games": "sports", "gaming": "sports",
    "research": "science", "math": "science", "mathematics": "science", "education": "science",
    "sustainability": "social_impact", "environment": "social_impact", "community": "social_impact", "policy": "social_impact",
}


class Listing(BaseModel):
    """What the competition is, for browsing: its category, region, and both languages."""

    @field_validator("category", mode="before")
    @classmethod
    def known_category(cls, v):
        # Map near misses ("music" -> "performance"); anything unknown becomes "other"
        if not isinstance(v, str):
            return v
        k = v.strip().lower().replace(" ", "_").replace("&", "and")
        known = {"hackathon", "tech", "startup", "design", "film_photo", "writing", "art", "performance",
                 "science", "social_impact", "sports", "other"}
        return k if k in known else CATEGORY_SYNONYMS.get(k, "other")

    category: Category = Field(..., description="One category. " + CATEGORY_HELP)
    region: Region = Field(..., description='"tw" if it is organized in Taiwan or mainly for people in Taiwan (Taiwanese '
                           'schools, government or companies); "intl" if it is organized abroad. A foreign competition '
                           'listed on a Taiwanese site is "intl".')
    en: Texts = Field(..., description="Everything in natural English.")
    zh: Texts = Field(..., description="Everything in natural Traditional Chinese as used in Taiwan.")


class Extraction(BaseModel):
    team_rules: list[TeamRule] = Field(
        default_factory=list,
        description="Every team-size rule found. One entry per track when tracks differ.",
    )
    individual_only: bool = Field(
        False, description="True only when the text says entries are individual only (no teams at all)."
    )
    teams_allowed: Optional[bool] = Field(
        None, description="True only if the text explicitly says people may enter as a team (組隊, 團體報名, teams of...). "
        "False if teams are not allowed. Null if the text does not say. Do not assume."
    )
    eligibility: Optional[Eligibility] = Field(None, description="Who can enter, if the text says.")
    needs_review: bool = Field(
        False, description="True when the rules are ambiguous, contradict each other, or you are unsure."
    )
    review_reason: Optional[str] = Field(None, description="Why a person should check this, when needs_review is true.")
    listing: Optional[Listing] = Field(None, description="Category, region, and the competition in English and in Traditional Chinese.")


class Track(BaseModel):
    """A verified team-size rule, as the website shows it."""

    name: Optional[str] = None
    min: Optional[int] = None
    max: Optional[int] = None
    solo: Optional[bool] = None  # one person may enter alone
    unlimited: Optional[bool] = None  # the rules say there is no limit on team size
    mentors: Optional[int] = None
    evidence: str  # the exact quote, in the page's own language
    name_en: Optional[str] = None
    name_zh: Optional[str] = None
    evidence_en: Optional[str] = None
    evidence_zh: Optional[str] = None


class Issue(BaseModel):
    code: str
    detail: str


class Decision(BaseModel):
    status: Status
    listed: bool = False  # shown on the website (sizes only when verified)
    tracks: list[Track] = Field(default_factory=list)
    eligibility: Optional[str] = None
    eligibility_evidence: Optional[str] = None
    issues: list[Issue] = Field(default_factory=list)
    listing: Optional[Listing] = None


class TeamSize(BaseModel):
    min: Optional[int] = Field(None, ge=1, le=100)
    max: Optional[int] = Field(None, ge=2, le=100)
    unlimited: bool = False


class Published(BaseModel):
    """The data contract the website reads (the same rules as src/shared/contract.js)."""

    id: str = Field(pattern=r"^[a-z]+-[\w-]+$")
    source: Source
    region: Region
    kind: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    organizer: str = Field("", max_length=200)
    url: str = Field(pattern=r"^https?://")
    start: Optional[str] = None
    end: Optional[str] = None
    deadline: Optional[str] = None
    where: str = Field("", max_length=120)
    tags: list[str] = Field(default_factory=list, max_length=8)
    prize: str = Field("", max_length=60)
    summary: str = Field("", max_length=200)
    team: TeamSize
    tracks: list[Track] = Field(default_factory=list)
    eligibility: Optional[str] = Field(None, max_length=300)
    category: Category = "other"
    # The listing in each language: {"en": {name, organizer, summary, eligibility, tags}, "zh": {...}}
    i18n: dict = Field(default_factory=dict)
