import pytest
from pydantic import ValidationError

from vocab_pipeline.models import Item, Step, slugify


def noun(**overrides):
    base = {"de": "Brot", "pos": "noun", "art": "das", "pl": "Brote", "en": "bread",
            "ex": "Das Brot ist frisch.", "ex_en": "The bread is fresh."}
    return {**base, **overrides}


def test_valid_noun_passes():
    assert Item.model_validate(noun()).art == "das"


def test_noun_without_article_is_rejected():
    with pytest.raises(ValidationError, match="needs an article"):
        Item.model_validate(noun(art=None))


def test_noun_must_be_capitalised():
    with pytest.raises(ValidationError, match="capital letter"):
        Item.model_validate(noun(de="brot"))


def test_verb_cannot_have_article():
    with pytest.raises(ValidationError, match="must be empty"):
        Item.model_validate(noun(de="essen", pos="verb", pl=None))


def test_long_example_is_rejected():
    with pytest.raises(ValidationError, match="longer than"):
        Item.model_validate(noun(ex="Das " + "sehr " * 30 + "Brot."))


def test_unknown_field_is_rejected():
    with pytest.raises(ValidationError):
        Item.model_validate(noun(colour="red"))


def step(options):
    return {"npc": "Hallo!", "npc_en": "Hi!", "options": options}


def test_step_needs_exactly_one_correct_option():
    with pytest.raises(ValidationError, match="exactly one correct"):
        Step.model_validate(step([{"de": "A", "ok": True}, {"de": "B", "ok": True}]))


def test_wrong_option_needs_reason():
    with pytest.raises(ValidationError, match="needs a 'why'"):
        Step.model_validate(step([{"de": "A", "ok": True}, {"de": "B", "ok": False}]))


@pytest.mark.parametrize("text,expected", [
    ("Brötchen", "broetchen"),
    ("Straße", "strasse"),
    ("Wie bitte?", "wie-bitte"),
    ("Ich hätte gern …", "ich-haette-gern"),
])
def test_slugify(text, expected):
    assert slugify(text) == expected
