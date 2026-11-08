from vocab_pipeline.core_decks import BANDS, build_core_decks, cross_check, entry_to_item
from vocab_pipeline.lexicon import Entry, Lemma, Lexicon
from vocab_pipeline.models import PackFile


def lemma(i, pos="verb"):
    word = f"Wort{i}" if pos == "noun" else f"wort{i}"
    entry = Entry(word, pos, "das" if pos == "noun" else None, None, [f"meaning {i}"])
    return Lemma(word, pos, 10_000 - i, entry)


def test_entry_to_item_builds_noun_card():
    item = entry_to_item(Entry("Brot", "noun", "das", "Brote", ["bread", "loaf"], ("Das Brot.", "The bread.")))
    assert (item.art, item.pl, item.en, item.ex) == ("das", "Brote", "bread; loaf", "Das Brot.")


def test_noun_without_article_is_skipped():
    assert entry_to_item(Entry("Brot", "noun", None, None, ["bread"])) is None


def test_bands_fill_to_cumulative_targets_and_skip_known():
    ranked = [lemma(i) for i in range(5000)]
    known = {"A1": {"wort0", "wort1"}, "A2": {"wort2", "wort3", "wort4"}}
    decks = build_core_decks(ranked, known, deck_size=40)
    sizes = {lvl: sum(len(d.items) for d in ds) for lvl, ds in decks.items()}
    # each level's situation words count toward that level only
    assert sizes == {"A1": 798, "A2": 897, "B1": 1200, "B2": 1100}
    all_words = [i.de for ds in decks.values() for d in ds for i in d.items]
    assert "wort0" not in all_words and "wort3" not in all_words
    assert len(all_words) == len(set(all_words))
    assert sum(sizes.values()) + 5 == BANDS[-1][1]


def test_decks_stay_inside_their_phase_weeks():
    decks = build_core_decks([lemma(i) for i in range(5000)], {})
    for level, first, last in [("A1", 1, 6), ("A2", 7, 12), ("B1", 13, 19), ("B2", 20, 26)]:
        assert all(first <= d.week <= last for d in decks[level])
        assert all(5 <= len(d.items) <= 44 for d in decks[level])


def test_cross_check_reports_article_and_plural_differences():
    lx = Lexicon([Entry("Pfand", "noun", "das", "Pfänder", ["deposit"])])
    pf = PackFile.model_validate({"level": "A1", "version": "0.1.0", "packs": [{
        "slug": "s", "title": "T", "title_en": "T", "week": 1,
        "items": [{"de": "Pfand", "pos": "noun", "art": "der", "pl": "Pfande", "en": "deposit"}]
                 + [{"de": f"wort{i}", "pos": "verb", "en": "x"} for i in range(4)],
        "dialogue": {"setting": "x", "steps": [
            {"npc": "a", "npc_en": "a", "options": [{"de": "a", "ok": True}, {"de": "b", "ok": False, "why": "c"}]},
            {"npc": "a", "npc_en": "a", "options": [{"de": "a", "ok": True}, {"de": "b", "ok": False, "why": "c"}]}]},
    }]})
    issues = {(i.word, i.field) for i in cross_check([pf], lx)}
    assert issues == {("Pfand", "article"), ("Pfand", "plural")}
