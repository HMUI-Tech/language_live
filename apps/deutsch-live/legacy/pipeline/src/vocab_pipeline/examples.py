"""Hand-written example sentences for core words, and a check that each one
really uses its word (in any inflected or separated form)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .lexicon import Lexicon

MAX_CHARS = 90
SEPARABLE_PREFIXES = sorted(
    ["ab", "an", "auf", "aus", "bei", "dar", "durch", "ein", "fern", "fest", "fort", "her", "heraus",
     "herein", "herum", "hin", "hinaus", "hinein", "los", "mit", "nach", "nieder", "raus", "rein",
     "rüber", "rum", "statt", "vor", "voran", "vorbei", "weg", "weiter", "wieder", "zu", "zurück",
     "zusammen", "um", "über", "unter", "kennen", "kaputt", "sauber", "fertig", "frei", "krank",
     "spazieren", "kennenlernen"],
    key=len, reverse=True,
)
_WORD = re.compile(r"[A-Za-zÄÖÜäöüßÀ-ÖØ-öø-ÿ]+")


@dataclass(frozen=True)
class Example:
    de: str
    en: str
    meaning: str | None = None  # replaces a misleading dictionary gloss
    pos: str | None = None      # corrects the part of speech (non-nouns only)


def load_examples(folder: Path) -> dict[str, Example]:
    """Merge every *.json file in the folder.

    Each entry: "word": ["German sentence.", "English."] with an optional third
    item (better English meaning) and fourth item (corrected part of speech).
    """
    out: dict[str, Example] = {}
    if not folder.is_dir():
        return out
    for path in sorted(folder.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for word, row in data.items():
            if not (isinstance(row, list) and 2 <= len(row) <= 4 and all(isinstance(x, str) for x in row)):
                raise ValueError(f"{path.name}: '{word}' must map to [German, English, meaning?, pos?]")
            if len(row) == 4 and row[3] not in ("verb", "adj", "adv", "phrase", "other"):
                raise ValueError(f"{path.name}: '{word}' has unknown part of speech {row[3]!r}")
            if word in out:
                raise ValueError(f"{path.name}: '{word}' appears in more than one examples file")
            out[word] = Example(row[0].strip(), row[1].strip(),
                                row[2].strip() if len(row) > 2 and row[2].strip() else None,
                                row[3] if len(row) > 3 else None)
    return out


@dataclass
class ExampleProblem:
    word: str
    sentence: str
    reason: str


def uses_word(word: str, pos: str, sentence: str, lexicon: Lexicon) -> bool:
    """True if some token of the sentence is the word or a form of it."""
    target = word.lower()
    tokens = [t.lower() for t in _WORD.findall(sentence)]
    for tok in tokens:
        if tok == target or word in lexicon.candidates(tok):
            return True
        if len(target) >= 5 and tok.startswith(target[:-1]):  # endings: freundlich -> freundliche
            return True
    if pos == "verb":
        if _stem_match(target, tokens):  # strong forms Wiktionary lists only in tables: läuft -> lauf(en)
            return True
        for prefix in SEPARABLE_PREFIXES:
            if target.startswith(prefix) and len(target) > len(prefix) + 2:
                base = target[len(prefix):]
                if any(tok == prefix + "zu" + base for tok in tokens):  # anzurufen
                    return True
                if prefix in tokens and (
                    any(base in {c.lower() for c in lexicon.candidates(t)} or t == base for t in tokens)
                    or _stem_match(base, tokens)
                ):
                    return True  # Ich rufe dich an; Der Pass läuft ab
    return False


def _plain(text: str) -> str:
    return text.replace("ä", "a").replace("ö", "o").replace("ü", "u")


def _stem_match(verb: str, tokens: list[str]) -> bool:
    """A token starts with the verb's stem, ignoring umlauts (läuft, lauf-en)."""
    stem = _plain(verb[:-2] if verb.endswith("en") else verb[:-1])
    return len(stem) >= 3 and any(_plain(t).startswith(stem) for t in tokens)


def check_example(word: str, pos: str, de: str, en: str, lexicon: Lexicon) -> str | None:
    """Return a problem description, or None if the example is fine."""
    if not de or not en:
        return "empty sentence or translation"
    if len(de) > MAX_CHARS or len(en) > MAX_CHARS:
        return f"longer than {MAX_CHARS} characters"
    if de[-1] not in ".!?…\"“”" or en[-1] not in ".!?…\"“”":
        return "sentence must end with punctuation"
    if not de[0].isupper():
        return "sentence must start with a capital letter"
    if not uses_word(word, pos, de, lexicon):
        return "the word (or a form of it) does not appear in the sentence"
    return None
