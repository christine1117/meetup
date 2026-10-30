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
    evidence: str = Field(
        ..., min_length=2,
        description="An exact quote copied character for character from the source text that states this rule.",
    )
    page: Optional[str] = Field(None, description="Which page the quote comes from, as labelled in the source text.")


class Eligibility(BaseModel):
    summary: str = Field(
        ..., min_length=2, max_length=200,
        description="Who can enter, in one short sentence, in the same language as the source.",
    )
    evidence: str = Field(..., min_length=2, description="An exact quote from the source text about who can enter.")


class Extraction(BaseModel):
    team_rules: list[TeamRule] = Field(
        default_factory=list,
        description="Every team-size rule found. One entry per track when tracks differ.",
    )
    individual_only: bool = Field(
        False, description="True only when the text says entries are individual only (no teams at all)."
    )
    eligibility: Optional[Eligibility] = Field(None, description="Who can enter, if the text says.")
    needs_review: bool = Field(
        False, description="True when the rules are ambiguous, contradict each other, or you are unsure."
    )
    review_reason: Optional[str] = Field(None, description="Why a person should check this, when needs_review is true.")


class Track(BaseModel):
    """A verified team-size rule, as the website shows it."""

    name: Optional[str] = None
    min: Optional[int] = None
    max: Optional[int] = None
    solo: Optional[bool] = None  # one person may enter alone
    mentors: Optional[int] = None
    evidence: str


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


class TeamSize(BaseModel):
    min: Optional[int] = Field(None, ge=1, le=100)
    max: Optional[int] = Field(None, ge=2, le=100)


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
