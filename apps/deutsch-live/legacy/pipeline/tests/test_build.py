import json
from pathlib import Path

import pytest

from vocab_pipeline.build import build, load_pack_file

REPO = Path(__file__).resolve().parents[2]
REAL_PACKS = REPO / "content" / "a1" / "packs.json"


def test_real_a1_content_passes_validation():
    pack_file = load_pack_file(REAL_PACKS)
    assert pack_file.level == "A1"
    assert len(pack_file.packs) >= 8


def test_build_writes_unique_stable_ids(tmp_path):
    content = build(REPO / "content", tmp_path / "content.json")
    ids = [item["id"] for p in content["packs"] for item in p["items"]]
    assert len(ids) == len(set(ids))
    assert "baeckerei.broetchen" in ids
    written = json.loads((tmp_path / "content.json").read_text(encoding="utf-8"))
    assert written == content


def test_build_is_deterministic(tmp_path):
    first = build(REPO / "content", tmp_path / "a.json")
    second = build(REPO / "content", tmp_path / "b.json")
    assert first == second


def test_build_fails_clearly_without_content(tmp_path):
    with pytest.raises(FileNotFoundError, match="no \\*/packs.json"):
        build(tmp_path, tmp_path / "out.json")
