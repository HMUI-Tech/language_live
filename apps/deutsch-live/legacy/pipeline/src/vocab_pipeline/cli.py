"""Command line entry point.

    vocab lexicon-extract DUMP|-      compact the kaikki.org German dump (or stdin) into data/lexicon.jsonl
    vocab check                       cross-check hand-written nouns against Wiktionary
    vocab core-decks FREQ_FILE        build level-banded core decks up to 4,000 words
    vocab build                       validate all packs and write the app content
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import build as build_mod
from .config import Settings
from .core_decks import build_core_decks, cross_check
from .examples import check_example, load_examples
from .frequency import load_frequency_file
from .lexicon import Lexicon, extract, iter_lines, load_exclude


def _situation_files(settings: Settings) -> list:
    files = []
    for path in sorted(settings.content_dir.glob("*/packs.json")):
        pf = build_mod.load_pack_file(path)
        if any(p.kind == "situation" for p in pf.packs):
            files.append(pf)
    return files


def cmd_lexicon_extract(settings: Settings, args: argparse.Namespace) -> int:
    settings.lexicon_path.parent.mkdir(parents=True, exist_ok=True)
    with settings.lexicon_path.open("w", encoding="utf-8") as out:
        if args.dump == "-":
            n = extract(iter_lines(sys.stdin.buffer), out)
        else:
            with open(args.dump, "rb") as fh:
                n = extract(iter_lines(fh), out)
    print(f"OK: {n} entries -> {settings.lexicon_path}")
    return 0


def cmd_check(settings: Settings, _: argparse.Namespace) -> int:
    lexicon = Lexicon.load(settings.lexicon_path)
    issues = cross_check(_situation_files(settings), lexicon)
    for i in issues:
        print(f"  {i.pack}: {i.word} {i.field}: ours={i.ours} wiktionary={i.wiktionary}")
    print(f"{'OK' if not issues else 'REVIEW'}: {len(issues)} difference(s)")
    return 0


def cmd_core_decks(settings: Settings, args: argparse.Namespace) -> int:
    lexicon = Lexicon.load(settings.lexicon_path)
    exclude = load_exclude(settings.content_dir / "exclude.txt")
    ranked = lexicon.rank(load_frequency_file(Path(args.freq_file)), exclude=exclude)
    known: dict[str, set[str]] = {}
    for pf in _situation_files(settings):
        known.setdefault(pf.level, set()).update(item.de for p in pf.packs for item in p.items)
    examples, problems = _checked_examples(settings, lexicon, ranked)
    for word, reason in problems:
        print(f"  example skipped: {word}: {reason}")
    decks = build_core_decks(ranked, known, deck_size=args.deck_size, examples=examples)
    total = 0
    for level, level_decks in decks.items():
        out = settings.content_dir / f"core-{level.lower()}" / "packs.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        doc = {"level": level, "version": args.version, "source": "Wiktionary via kaikki.org (CC BY-SA 4.0)",
               "packs": [d.to_json() for d in level_decks]}
        out.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
        n = sum(len(d.items) for d in level_decks)
        total += n
        print(f"  {level}: {len(level_decks)} decks, {n} words -> {out}")
    situational = sum(len(words) for words in known.values())
    print(f"OK: {total} core words + {situational} in situation packs = {total + situational}")
    return 0


def _checked_examples(settings: Settings, lexicon: Lexicon, ranked) -> tuple[dict, list]:
    """Load hand-written examples and keep only those that pass check_example."""
    pos_of = {l.word: l.pos for l in ranked}
    good, problems = {}, []
    for word, ex in load_examples(settings.content_dir / "examples").items():
        if word not in pos_of:
            continue  # word no longer in the ranked list
        reason = check_example(word, ex.pos or pos_of[word], ex.de, ex.en, lexicon)
        if reason:
            problems.append((word, reason))
        else:
            good[word] = ex
    return good, problems


def cmd_build(settings: Settings, _: argparse.Namespace) -> int:
    content = build_mod.build(settings.content_dir, settings.app_content_path)
    items = sum(len(p["items"]) for p in content["packs"])
    print(f"OK: {len(content['packs'])} packs, {items} items -> {settings.app_content_path}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vocab")
    sub = parser.add_subparsers(dest="command", required=True)
    p_ext = sub.add_parser("lexicon-extract")
    p_ext.add_argument("dump", help="path to kaikki.org-dictionary-German.jsonl, or - for stdin")
    sub.add_parser("check")
    p_core = sub.add_parser("core-decks")
    p_core.add_argument("freq_file")
    p_core.add_argument("--deck-size", type=int, default=40)
    p_core.add_argument("--version", default="0.2.0")
    sub.add_parser("build")
    args = parser.parse_args(argv)

    handlers = {"lexicon-extract": cmd_lexicon_extract, "check": cmd_check,
                "core-decks": cmd_core_decks, "build": cmd_build}
    try:
        return handlers[args.command](Settings.from_env(), args)
    except (ValueError, FileNotFoundError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
