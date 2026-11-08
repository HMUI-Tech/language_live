import pytest

from vocab_pipeline.frequency import is_candidate, parse_lines, select_candidates


def test_parse_lines_reads_pairs_and_skips_blanks():
    assert list(parse_lines(["ich 100", "", "du 90"])) == [("ich", 100), ("du", 90)]


def test_parse_lines_rejects_malformed_line():
    with pytest.raises(ValueError, match="line 2"):
        list(parse_lines(["ich 100", "kaputt"]))


@pytest.mark.parametrize("word,ok", [
    ("brötchen", True), ("straße", True), ("a", False), ("2024", False), ("o.k.", False),
])
def test_is_candidate(word, ok):
    assert is_candidate(word) is ok


def test_select_merges_case_drops_known_and_ranks():
    pairs = [("Haus", 50), ("haus", 30), ("und", 500), ("Brot", 40), ("x", 999)]
    result = select_candidates(pairs, top_n=10, known={"brot"})
    assert [(c.word, c.count, c.rank) for c in result] == [("und", 500, 1), ("haus", 80, 2)]


def test_select_respects_top_n():
    pairs = [(w, 10 - i) for i, w in enumerate(["aa", "bb", "cc", "dd"])]
    assert len(select_candidates(pairs, top_n=2)) == 2


def test_select_rejects_non_positive_top_n():
    with pytest.raises(ValueError):
        select_candidates([], top_n=0)
