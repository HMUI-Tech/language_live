import io
import json

from vocab_pipeline.lexicon import Entry, Lexicon, extract, load_exclude, parse_entry


def noun(word, gender_arg, plural, gloss, tags=("neuter",), example=None):
    sense = {"glosses": [gloss], "tags": list(tags)}
    if example:
        sense["examples"] = [{"text": example[0], "english": example[1], "type": "example"}]
    return {"word": word, "pos": "noun", "head_templates": [{"name": "de-noun", "args": {"1": gender_arg}}],
            "forms": [{"form": plural, "tags": ["plural"]},
                      {"form": plural, "tags": ["dative", "plural"], "source": "declension"}],
            "senses": [sense]}


def form(word, pos, lemma):
    return {"word": word, "pos": pos, "senses": [{"form_of": [{"word": lemma}], "tags": ["form-of"]}]}


def lemma(word, pos, gloss, tags=()):
    return {"word": word, "pos": pos, "senses": [{"glosses": [gloss], "tags": list(tags)}]}


def test_noun_gender_comes_from_headword_line_first():
    # Wiktionary tags Pfand as both genders; the headword line says neuter first
    e = parse_entry(noun("Pfand", "n,es,^er", "Pfänder", "deposit", tags=("masculine", "neuter")))
    assert (e.article, e.plural, e.glosses) == ("das", "Pfänder", ["deposit"])


def test_short_example_is_kept():
    e = parse_entry(noun("Brot", "n,es,e", "Brote", "bread", example=("Das Brot ist frisch.", "The bread is fresh.")))
    assert e.example == ("Das Brot ist frisch.", "The bread is fresh.")


def test_verb_glosses_lead_with_plain_meaning():
    raw = {"word": "haben", "pos": "verb", "senses": [
        {"glosses": ["forms the perfect aspect"]}, {"glosses": ["to have; to own"]}]}
    assert parse_entry(raw).glosses[0] == "to have"


def test_long_gloss_is_cut_at_a_word_boundary():
    e = parse_entry(lemma("Feierabend", "noun", "quitting time and the evening that follows after a long working day at the office"))
    assert e.glosses[0].endswith("…") and len(e.glosses[0]) <= 61 and "  " not in e.glosses[0]


def test_vulgar_entries_are_marked_skip():
    assert parse_entry(lemma("Scheiße", "noun", "shit", tags=("vulgar",))).skip


def test_form_entries_point_to_their_lemma():
    e = parse_entry(form("bin", "verb", "sein"))
    assert e.form_of == ["sein"] and not e.glosses


def test_extract_skips_bad_lines_and_names():
    raw = "\n".join([json.dumps(lemma("gehen", "verb", "to go")), "{broken", json.dumps(lemma("Bob", "name", "Bob"))])
    out = io.StringIO()
    assert extract(raw.splitlines(), out) == 1
    assert json.loads(out.getvalue())["w"] == "gehen"


def build_lexicon():
    raws = [
        lemma("sein", "verb", "to be"), lemma("Sein", "noun", "being", tags=("neuter",)),
        form("bin", "verb", "sein"), form("ist", "verb", "sein"),
        lemma("haben", "verb", "to have"), lemma("Habe", "noun", "belongings", tags=("feminine",)),
        form("habe", "verb", "haben"), form("hat", "verb", "haben"),
        noun("Tag", "m,es,e", "Tage", "day", tags=("masculine",)), form("tage", "noun", "Tag"),
        form("tagen", "noun", "Tag"), lemma("tagen", "verb", "to hold a meeting"),
        lemma("schon", "adv", "already"), lemma("schonen", "verb", "to spare"), form("schon", "verb", "schonen"),
        lemma("ich", "pron", "I"), lemma("Ich", "noun", "ego", tags=("neuter",)),
        lemma("Dr.", "noun", "doctor", tags=("masculine",)),
    ]
    return Lexicon(parse_entry(r) for r in raws)


def test_forms_fold_onto_lemma_of_same_part_of_speech():
    lx = build_lexicon()
    assert lx.candidates("bin") == {"sein"}  # not the noun das Sein
    assert lx.candidates("habe") == {"haben", "Habe"}  # rank() weighs them


def test_rank_splits_ambiguous_tokens_by_evidence():
    lx = build_lexicon()
    ranked = lx.rank([("bin", 100), ("ist", 100), ("sein", 50), ("habe", 80), ("hat", 80),
                      ("tag", 0), ("tage", 300), ("tagen", 40), ("schon", 500), ("ich", 900), ("dr.", 10)])
    words = [l.word for l in ranked]
    assert words[0] == "ich" and "Ich" not in words  # case twins merge into the lowercase lemma
    assert "schon" in words and "schonen" not in words[:3]
    assert words.index("Tag") < words.index("tagen")  # plural "tagen" goes mostly to Tag
    assert "Dr." not in words
    counts = {l.word: l.count for l in ranked}
    assert counts.get("Habe", 0) < counts["haben"] * 0.05  # "habe" is overwhelmingly the verb


def test_exclude_is_exact_spelling():
    lx = build_lexicon()
    words = [l.word for l in lx.rank([("ich", 10), ("schon", 5)], exclude={"Ich"})]
    assert "ich" in words  # excluding "Ich" leaves "ich"


def test_load_exclude_ignores_comments(tmp_path):
    f = tmp_path / "exclude.txt"
    f.write_text("# comment\nBob\n\nzeit  # trailing\n", encoding="utf-8")
    assert load_exclude(f) == {"Bob", "zeit"}
    assert load_exclude(tmp_path / "missing.txt") == set()


def test_entry_json_round_trip():
    e = Entry("Brot", "noun", "das", "Brote", ["bread"], ("Das Brot.", "The bread."))
    assert Entry.from_json(e.to_json()) == e
