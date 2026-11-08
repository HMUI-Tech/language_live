"""Turn ranked Wiktionary lemmas into level-banded core decks, and cross-check
hand-written packs against Wiktionary."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

from .examples import Example
from .lexicon import Entry, Lemma, Lexicon
from .models import Item, PackFile

# Cumulative vocabulary targets from the 26-week plan, with each phase's weeks.
BANDS = [
    ("A1", 800, 1, 6),
    ("A2", 1700, 7, 12),
    ("B1", 2900, 13, 19),
    ("B2", 4000, 20, 26),
]
MAX_EN = 80


def entry_to_item(entry: Entry, extra: Optional[Example] = None) -> Optional[Item]:
    """Build a card from dictionary facts; None if the entry can't make a valid card.

    `extra` (hand-written) corrects the meaning or part of speech, and supplies
    an example sentence when Wiktionary has none.
    """
    if entry.pos == "noun" and not entry.article:
        return None
    en = entry.glosses[0] if entry.glosses else ""
    if len(entry.glosses) > 1 and len(en) + len(entry.glosses[1]) + 2 <= MAX_EN:
        en = f"{en}; {entry.glosses[1]}"
    if extra and extra.meaning:
        en = extra.meaning
    if not en:
        return None
    pos = extra.pos if extra and extra.pos and entry.pos != "noun" else entry.pos
    data = {"de": entry.word, "pos": pos, "en": en[:MAX_EN]}
    if entry.pos == "noun":
        data["art"] = entry.article
        if entry.plural and entry.plural != "-":
            data["pl"] = entry.plural
    if entry.example:
        data["ex"], data["ex_en"] = entry.example
    elif extra:
        data["ex"], data["ex_en"] = extra.de, extra.en
    try:
        return Item.model_validate(data)
    except ValueError:
        return None


@dataclass
class Deck:
    level: str
    slug: str
    title: str
    title_en: str
    week: int
    items: list[Item]

    def to_json(self) -> dict:
        return {
            "slug": self.slug, "kind": "core", "title": self.title, "title_en": self.title_en,
            "week": self.week, "items": [i.model_dump(exclude_none=True) for i in self.items],
        }


def build_core_decks(
    ranked: Iterable[Lemma], known: dict[str, set[str]], deck_size: int = 40,
    examples: Optional[dict[str, Example]] = None,
) -> dict[str, list[Deck]]:
    """Fill each CEFR band up to its cumulative target with the most frequent unknown lemmas.

    `known` maps a level to the words its situation packs already teach. They
    count toward that level's target and are never repeated in a core deck.
    """
    if deck_size < 5:
        raise ValueError("deck_size must be at least 5")
    taught = {w.lower() for words in known.values() for w in words}
    total = 0
    pool = iter(ranked)
    out: dict[str, list[Deck]] = {}
    for level, target, first_week, last_week in BANDS:
        total += len({w.lower() for w in known.get(level, set())})
        items: list[Item] = []
        while total < target:
            lemma = next(pool, None)
            if lemma is None:
                break
            if lemma.word.lower() in taught:
                continue
            item = entry_to_item(lemma.entry, (examples or {}).get(lemma.word))
            if item is None:
                continue
            taught.add(lemma.word.lower())
            items.append(item)
            total += 1
        chunks = [items[i:i + deck_size] for i in range(0, len(items), deck_size)]
        if len(chunks) > 1 and len(chunks[-1]) < 5:  # never leave a tiny last deck
            chunks[-2].extend(chunks.pop())
        weeks = last_week - first_week + 1
        decks = []
        for n, chunk in enumerate(chunks, start=1):
            week = first_week + (n - 1) * weeks // max(1, len(chunks))
            decks.append(Deck(level=level, slug=f"kern-{level.lower()}-{n:02d}",
                              title=f"Kernwortschatz {level} · {n}",
                              title_en=f"Core words {level}, set {n} of {len(chunks)}",
                              week=week, items=chunk))
        out[level] = decks
    return out


@dataclass
class Mismatch:
    pack: str
    word: str
    field: str
    ours: Optional[str]
    wiktionary: Optional[str]


def cross_check(pack_files: Iterable[PackFile], lexicon: Lexicon) -> list[Mismatch]:
    """Compare articles and plurals of hand-written nouns with Wiktionary."""
    issues: list[Mismatch] = []
    for pf in pack_files:
        for pack in pf.packs:
            if pack.kind != "situation":
                continue
            for item in pack.items:
                if item.pos != "noun":
                    continue
                ref = lexicon.noun(item.de)
                if ref is None:
                    issues.append(Mismatch(pack.slug, item.de, "missing", None, None))
                    continue
                if ref.article and ref.article != item.art:
                    issues.append(Mismatch(pack.slug, item.de, "article", item.art, ref.article))
                if item.pl and ref.plural and ref.plural != item.pl:
                    issues.append(Mismatch(pack.slug, item.de, "plural", item.pl, ref.plural))
    return issues
