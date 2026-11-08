"""German lexicon from Wiktionary (kaikki.org's JSONL extract, CC BY-SA 4.0).

Two stages:
1. extract(): stream the 1 GB dump once and keep a compact record per entry
   (lemma facts, or the lemma an inflected form points to).
2. Lexicon: look up article, plural, meaning; fold inflected forms onto lemmas
   so frequency counts rank lemmas, not forms.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO, Iterable, Iterator, Optional

GENDER_TO_ARTICLE = {"masculine": "der", "feminine": "die", "neuter": "das"}
POS_MAP = {
    "noun": "noun", "verb": "verb", "adj": "adj", "adv": "adv",
    "pron": "other", "prep": "other", "conj": "other", "det": "other",
    "article": "other", "num": "other", "particle": "other", "intj": "other",
    "phrase": "phrase", "contraction": "other",
}
# Entries tagged with any of these are not taught.
SKIP_TAGS = {"vulgar", "offensive", "derogatory", "slur", "ethnic", "obsolete", "archaic", "dated", "rare", "historical"}
# Senses with these tags are not used for the English meaning.
WEAK_SENSE_TAGS = {"obsolete", "archaic", "dated", "rare", "historical", "dialectal", "regional", "Austria", "Switzerland"}
MAX_EXAMPLE_CHARS = 90


@dataclass
class Entry:
    word: str
    pos: str
    article: Optional[str] = None
    plural: Optional[str] = None
    glosses: list[str] = field(default_factory=list)
    example: Optional[tuple[str, str]] = None
    form_of: list[str] = field(default_factory=list)
    skip: bool = False

    def to_json(self) -> dict:
        out = {"w": self.word, "p": self.pos}
        if self.article:
            out["a"] = self.article
        if self.plural:
            out["pl"] = self.plural
        if self.glosses:
            out["g"] = self.glosses
        if self.example:
            out["ex"] = list(self.example)
        if self.form_of:
            out["of"] = self.form_of
        if self.skip:
            out["skip"] = True
        return out

    @classmethod
    def from_json(cls, d: dict) -> "Entry":
        ex = d.get("ex")
        return cls(word=d["w"], pos=d["p"], article=d.get("a"), plural=d.get("pl"),
                   glosses=d.get("g", []), example=tuple(ex) if ex else None,
                   form_of=d.get("of", []), skip=d.get("skip", False))


def _clean_gloss(text: str, limit: int = 60) -> str:
    """Drop parentheticals, keep the first clause, cut at a word boundary."""
    text = re.sub(r"\s*\([^)]*\)", "", text)
    text = text.split(";")[0].strip(" ,.:")
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,")
    return cut + "…"


def _head_gender(raw: dict) -> Optional[str]:
    """First gender on the headword line (de-noun template arg '1', e.g. 'n,es,^er')."""
    for tpl in raw.get("head_templates", []):
        first = str(tpl.get("args", {}).get("1", ""))[:1]
        if first in ("m", "f", "n"):
            return {"m": "der", "f": "die", "n": "das"}[first]
        if first == "p":
            return "die"
    return None


def parse_entry(raw: dict) -> Optional[Entry]:
    """Turn one kaikki record into an Entry, or None if it is not a teachable word."""
    pos = POS_MAP.get(raw.get("pos", ""))
    word = raw.get("word", "")
    if not pos or not word or " " in word.strip() and pos != "phrase":
        return None
    senses = raw.get("senses") or []
    form_of = sorted({f["word"] for s in senses for f in s.get("form_of", []) if f.get("word")})
    sense_tags = [set(s.get("tags", [])) for s in senses]
    if form_of and all("form-of" in t for t in sense_tags):
        return Entry(word=word, pos=pos, form_of=form_of)

    entry = Entry(word=word, pos=pos)
    all_tags = set().union(*sense_tags) if sense_tags else set()
    good_senses = [s for s, t in zip(senses, sense_tags) if not (t & WEAK_SENSE_TAGS) and "form-of" not in t]
    if not good_senses or all(set(s.get("tags", [])) & SKIP_TAGS for s in senses):
        entry.skip = True
    if all_tags & {"vulgar", "offensive", "derogatory", "slur"}:
        entry.skip = True

    if pos == "noun":
        entry.article = _head_gender(raw)
        if entry.article is None:
            for gender, article in GENDER_TO_ARTICLE.items():
                if gender in all_tags:
                    entry.article = article
                    break
        if entry.article is None and ("plural-only" in all_tags or "plural" in all_tags):
            entry.article = "die"
        for form in raw.get("forms", []):
            tags = set(form.get("tags", []))
            if "plural" in tags and form.get("source") != "declension" and "genitive" not in tags:
                entry.plural = form["form"]
                break

    for sense in good_senses:
        glosses = sense.get("glosses") or []
        if glosses:
            gloss = _clean_gloss(glosses[-1])
            if gloss and gloss not in entry.glosses:
                entry.glosses.append(gloss)
        if entry.example is None:
            for ex in sense.get("examples", []):
                de, en = ex.get("text", ""), ex.get("english") or ex.get("translation") or ""
                if de and en and len(de) <= MAX_EXAMPLE_CHARS and len(en) <= MAX_EXAMPLE_CHARS and ex.get("type") == "example":
                    entry.example = (de.strip(), en.strip())
                    break
        if len(entry.glosses) >= 3:
            break
    if pos == "verb":  # lead with the plain meaning ("to have"), not the auxiliary use
        entry.glosses.sort(key=lambda g: 0 if g.startswith("to ") else 1)
    return entry


def extract(lines: Iterable[str], out: IO[str]) -> int:
    """Stream raw kaikki JSONL lines to compact JSONL; returns entries written."""
    written = 0
    for line in lines:
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue  # a truncated last line in a partial download
        entry = parse_entry(raw)
        if entry is not None:
            out.write(json.dumps(entry.to_json(), ensure_ascii=False) + "\n")
            written += 1
    return written


@dataclass(frozen=True)
class Lemma:
    word: str
    pos: str
    count: int
    entry: Entry


class Lexicon:
    def __init__(self, entries: Iterable[Entry]) -> None:
        self._lemmas: dict[str, list[Entry]] = {}
        self._forms: dict[str, set[tuple[str, str]]] = {}  # token -> {(lemma, pos)}
        for e in entries:
            if e.form_of:
                self._forms.setdefault(e.word.lower(), set()).update((lemma, e.pos) for lemma in e.form_of)
            else:
                self._lemmas.setdefault(e.word.lower(), []).append(e)

    @classmethod
    def load(cls, path: Path) -> "Lexicon":
        if not path.is_file():
            raise FileNotFoundError(f"lexicon not found: {path} (run `vocab lexicon-extract` first)")
        with path.open(encoding="utf-8") as fh:
            return cls(Entry.from_json(json.loads(line)) for line in fh if line.strip())

    def entries(self, word: str) -> list[Entry]:
        return self._lemmas.get(word.lower(), [])

    def noun(self, word: str) -> Optional[Entry]:
        """The noun entry whose spelling matches exactly (Essen, not essen)."""
        return next((e for e in self.entries(word) if e.pos == "noun" and e.word == word), None)

    def candidates(self, form: str) -> set[str]:
        """Every lemma a lowercase frequency-list token could stand for.

        Direct lemmas in any case (essen -> essen, Essen) plus, for inflected
        forms, lemmas of the form's part of speech (bin -> sein, tagen -> Tag).
        """
        token = form.lower()
        out = {e.word for e in self.entries(token)}
        for lemma, pos in self._forms.get(token, set()):
            out.update(e.word for e in self.entries(lemma) if e.pos == pos)
        return out

    def rank(self, pairs: Iterable[tuple[str, int]], exclude: Iterable[str] = ()) -> list[Lemma]:
        """Fold token counts onto lemmas and return teachable lemmas, most frequent first.

        Pass 1 credits tokens that can only mean one lemma. Pass 2 splits each
        ambiguous token in proportion to that evidence (+1 smoothing), plus the
        token's own count for a lemma spelled exactly like it. So "tagen" goes
        mostly to Tag (strong evidence from "tag", "tage"), and "schon" stays
        with the adverb schon rather than the verb schonen.
        """
        pairs = list(pairs)
        cands = {tok: self.candidates(tok) for tok, _ in pairs}
        base: dict[str, float] = {}
        for tok, count in pairs:
            if len(cands[tok]) == 1:
                (only,) = cands[tok]
                base[only] = base.get(only, 0.0) + count
        counts: dict[str, float] = {}
        for tok, count in pairs:
            options = cands[tok]
            if not options:
                continue
            # a token spelled exactly like a lemma is strong evidence for it (schon -> schon, not schonen)
            is_form = bool(self._forms.get(tok))
            weights = {
                lem: base.get(lem, 0.0) + 1.0
                + (count if lem == tok or (lem.lower() == tok and not is_form) else 0)
                for lem in options
            }
            total = sum(weights.values())
            for lem, w in weights.items():
                counts[lem] = counts.get(lem, 0.0) + count * w / total

        excluded = set(exclude)  # exact spelling: "zeit" drops only the lowercase entry
        best_by_key: dict[str, Lemma] = {}
        for lemma, count in counts.items():
            if not _teachable_spelling(lemma) or lemma in excluded:
                continue
            entry = self.best_entry(lemma)
            if entry is None:
                continue
            key = lemma.lower()
            current = best_by_key.get(key)
            # case twins (ich / Ich): keep the lowercase spelling when it exists
            if current is None or (lemma == key and current.word != key):
                merged = count + (current.count if current else 0)
                best_by_key[key] = Lemma(word=entry.word, pos=entry.pos, count=round(merged), entry=entry)
            else:
                best_by_key[key] = Lemma(current.word, current.pos, round(current.count + count), current.entry)
        ranked = sorted(best_by_key.values(), key=lambda l: (-l.count, l.word))
        return ranked

    def best_entry(self, lemma: str) -> Optional[Entry]:
        candidates = [e for e in self.entries(lemma) if e.word == lemma and not e.skip and e.glosses]
        if not candidates:
            return None
        order = {"noun": 0, "verb": 1, "adj": 2, "adv": 3, "phrase": 4, "other": 5}
        candidates.sort(key=lambda e: order.get(e.pos, 9))
        return candidates[0]


def _teachable_spelling(word: str) -> bool:
    """Drop single letters, abbreviations (Dr., S.) and all-caps tokens (SO, AN)."""
    if len(word) < 2 or "." in word or any(ch.isdigit() for ch in word):
        return False
    if word.isupper():
        return False
    if any(ch.isupper() for ch in word[1:]):  # JuLi, McDonald
        return False
    return True


def load_exclude(path: Path) -> set[str]:
    """Read the exclude list: one word per line, '#' starts a comment."""
    if not path.is_file():
        return set()
    words = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        word = line.split("#", 1)[0].strip()
        if word:
            words.add(word)
    return words


def iter_lines(stream: IO[bytes]) -> Iterator[str]:
    for raw in stream:
        yield raw.decode("utf-8", errors="replace")
