import json

import pytest

from vocab_pipeline.examples import check_example, load_examples, uses_word
from vocab_pipeline.lexicon import Entry, Lexicon


@pytest.fixture
def lexicon():
    return Lexicon([
        Entry("anrufen", "verb", glosses=["to call"]),
        Entry("rufen", "verb", glosses=["to call"]),
        Entry("rufe", "verb", form_of=["rufen"]),
        Entry("sein", "verb", glosses=["to be"]),
        Entry("bin", "verb", form_of=["sein"]),
        Entry("Haus", "noun", "das", "Häuser", ["house"]),
    ])


@pytest.mark.parametrize("word,pos,sentence", [
    ("Haus", "noun", "Das Haus ist alt."),                    # exact
    ("sein", "verb", "Ich bin müde."),                        # inflected form via form_of
    ("freundlich", "adj", "Sie ist eine freundliche Frau."),  # adjective ending
    ("anrufen", "verb", "Ich rufe dich morgen an."),          # separable verb, split
    ("anrufen", "verb", "Vergiss nicht, sie anzurufen."),     # zu-infinitive
    ("ablaufen", "verb", "Der Pass läuft bald ab."),          # strong form, umlaut stem
    ("Café", "noun", "Wir treffen uns im Café."),             # accented letter
])
def test_uses_word_accepts_real_uses(lexicon, word, pos, sentence):
    assert uses_word(word, pos, sentence, lexicon)


@pytest.mark.parametrize("word,pos,sentence", [
    ("anrufen", "verb", "Ich rufe dich morgen."),  # prefix missing
    ("Haus", "noun", "Die Hose ist neu."),
    ("laufen", "adj", "Er läuft schnell."),         # stem rule is for verbs only
])
def test_uses_word_rejects_missing_word(lexicon, word, pos, sentence):
    assert not uses_word(word, pos, sentence, lexicon)


@pytest.mark.parametrize("de,en,problem", [
    ("", "Hi.", "empty"),
    ("das Haus ist alt.", "The house is old.", "capital"),
    ("Das Haus ist alt", "The house is old.", "punctuation"),
    ("Das Haus " + "sehr " * 20 + "alt.", "Old.", "longer"),
    ("Die Hose ist neu.", "The trousers are new.", "does not appear"),
])
def test_check_example_reports_problem(lexicon, de, en, problem):
    assert problem in check_example("Haus", "noun", de, en, lexicon)


def test_check_example_passes_good_sentence(lexicon):
    assert check_example("Haus", "noun", "Das Haus ist alt.", "The house is old.", lexicon) is None


def test_load_examples_merges_files_and_rejects_duplicates(tmp_path):
    (tmp_path / "a.json").write_text(json.dumps({"Haus": ["Das Haus.", "The house.", "house"]}))
    (tmp_path / "b.json").write_text(json.dumps({"gut": ["Gut!", "Good!", "", "adv"]}))
    ex = load_examples(tmp_path)
    assert ex["Haus"].meaning == "house" and ex["gut"].meaning is None and ex["gut"].pos == "adv"
    (tmp_path / "c.json").write_text(json.dumps({"Haus": ["Ein Haus.", "A house."]}))
    with pytest.raises(ValueError, match="more than one"):
        load_examples(tmp_path)


def test_load_examples_rejects_unknown_pos(tmp_path):
    (tmp_path / "a.json").write_text(json.dumps({"gut": ["Gut!", "Good!", "", "noun"]}))
    with pytest.raises(ValueError, match="part of speech"):
        load_examples(tmp_path)
