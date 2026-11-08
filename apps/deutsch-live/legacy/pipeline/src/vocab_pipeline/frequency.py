"""Ingest and filter a spoken-German frequency list into word candidates.

Input format (one entry per line, as in open subtitle-based lists):
    <word> <count>
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

GERMAN_LETTERS = set("abcdefghijklmnopqrstuvwxyzäöüß")


@dataclass(frozen=True)
class Candidate:
    word: str
    count: int
    rank: int


def parse_lines(lines: Iterable[str]) -> Iterator[tuple[str, int]]:
    """Yield (word, count) pairs; reject malformed lines with a clear error."""
    for line_no, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2 or not parts[1].isdigit():
            raise ValueError(f"line {line_no}: expected '<word> <count>', got {line!r}")
        yield parts[0], int(parts[1])


def is_candidate(word: str, min_len: int = 2) -> bool:
    """Keep real German words: letters only, at least min_len long."""
    lowered = word.lower()
    return len(lowered) >= min_len and all(ch in GERMAN_LETTERS for ch in lowered)


def select_candidates(
    pairs: Iterable[tuple[str, int]], top_n: int, known: set[str] | None = None
) -> list[Candidate]:
    """Filter, de-duplicate case-insensitively, drop known words, rank by count."""
    if top_n <= 0:
        raise ValueError("top_n must be positive")
    known_lower = {k.lower() for k in (known or set())}
    best: dict[str, int] = {}
    for word, count in pairs:
        key = word.lower()
        if not is_candidate(key) or key in known_lower:
            continue
        best[key] = best.get(key, 0) + count
    ordered = sorted(best.items(), key=lambda kv: (-kv[1], kv[0]))[:top_n]
    return [Candidate(word=w, count=c, rank=i) for i, (w, c) in enumerate(ordered, start=1)]


def load_frequency_file(path: Path) -> list[tuple[str, int]]:
    if not path.is_file():
        raise FileNotFoundError(f"frequency list not found: {path}")
    with path.open(encoding="utf-8") as fh:
        return list(parse_lines(fh))
