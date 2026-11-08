"""Content schema. Every rule a word or dialogue must pass lives here.

The same models validate hand-written packs and dictionary-built core decks, so both
kinds of content meet one bar before they reach the app.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Article = Literal["der", "die", "das"]
PartOfSpeech = Literal["noun", "verb", "adj", "adv", "phrase", "other"]
Level = Literal["A1", "A2", "B1", "B2"]

# Default limit; the build step can tighten it from Settings.
MAX_EXAMPLE_CHARS = 90


class Item(BaseModel):
    """One word or chunk the learner studies."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    de: str = Field(min_length=1, max_length=60)
    pos: PartOfSpeech
    en: str = Field(min_length=1, max_length=80)
    ex: Optional[str] = Field(default=None, min_length=3)
    ex_en: Optional[str] = Field(default=None, min_length=3)
    art: Optional[Article] = None
    pl: Optional[str] = None

    @field_validator("ex", "ex_en")
    @classmethod
    def example_is_short(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and len(value) > MAX_EXAMPLE_CHARS:
            raise ValueError(f"example longer than {MAX_EXAMPLE_CHARS} characters")
        return value

    @model_validator(mode="after")
    def example_pairs(self) -> "Item":
        if (self.ex is None) != (self.ex_en is None):
            raise ValueError(f"'{self.de}': give both ex and ex_en, or neither")
        return self

    @model_validator(mode="after")
    def noun_rules(self) -> "Item":
        if self.pos == "noun":
            if self.art is None:
                raise ValueError(f"noun '{self.de}' needs an article (der/die/das)")
            if not self.de[:1].isupper():
                raise ValueError(f"noun '{self.de}' must start with a capital letter")
        else:
            if self.art is not None or self.pl is not None:
                raise ValueError(f"'{self.de}' is a {self.pos}: article and plural must be empty")
        return self


class Option(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    de: str = Field(min_length=1)
    ok: bool
    why: Optional[str] = None

    @model_validator(mode="after")
    def wrong_needs_reason(self) -> "Option":
        if not self.ok and not self.why:
            raise ValueError(f"wrong option '{self.de}' needs a 'why' explanation")
        return self


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    npc: str = Field(min_length=1)
    npc_en: str = Field(min_length=1)
    options: list[Option] = Field(min_length=2, max_length=4)

    @model_validator(mode="after")
    def exactly_one_correct(self) -> "Step":
        correct = sum(1 for o in self.options if o.ok)
        if correct != 1:
            raise ValueError(f"step '{self.npc}' must have exactly one correct option, has {correct}")
        return self


class Dialogue(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    setting: str = Field(min_length=1)
    steps: list[Step] = Field(min_length=2)


class Pack(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    slug: str = Field(pattern=r"^[a-z0-9-]+$")
    kind: Literal["situation", "core"] = "situation"
    title: str
    title_en: str
    week: int = Field(ge=1, le=26)
    items: list[Item] = Field(min_length=5)
    dialogue: Optional[Dialogue] = None

    @model_validator(mode="after")
    def situations_have_dialogue(self) -> "Pack":
        if self.kind == "situation" and self.dialogue is None:
            raise ValueError(f"situation pack '{self.slug}' needs a dialogue")
        return self

    @model_validator(mode="after")
    def no_duplicate_words(self) -> "Pack":
        seen: set[str] = set()
        for item in self.items:
            key = item.de.lower()
            if key in seen:
                raise ValueError(f"pack '{self.slug}' lists '{item.de}' twice")
            seen.add(key)
        return self


class PackFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Level
    version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    source: Optional[str] = None  # licence/attribution for generated content
    packs: list[Pack] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_slugs(self) -> "PackFile":
        slugs = [p.slug for p in self.packs]
        dupes = {s for s in slugs if slugs.count(s) > 1}
        if dupes:
            raise ValueError(f"duplicate pack slugs: {sorted(dupes)}")
        return self


def slugify(text: str) -> str:
    """Stable ASCII id fragment: 'Brötchen' -> 'broetchen', 'Wie bitte?' -> 'wie-bitte'."""
    replacements = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}
    lowered = text.lower()
    for src, dst in replacements.items():
        lowered = lowered.replace(src, dst)
    ascii_text = unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
