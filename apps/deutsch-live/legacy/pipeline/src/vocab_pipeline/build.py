"""Validate pack files and build the single content file the app loads."""

from __future__ import annotations

import json
from pathlib import Path

from .models import PackFile, slugify


def load_pack_file(path: Path) -> PackFile:
    if not path.is_file():
        raise FileNotFoundError(f"pack file not found: {path}")
    with path.open(encoding="utf-8") as fh:
        return PackFile.model_validate(json.load(fh))


def to_app_content(pack_files: list[PackFile]) -> dict:
    """Flatten packs for the app and give every item a stable, unique id."""
    packs_out = []
    seen_ids: set[str] = set()
    for pack_file in pack_files:
        for pack in pack_file.packs:
            items_out = []
            for item in pack.items:
                item_id = f"{pack.slug}.{slugify(item.de)}"
                if item_id in seen_ids:
                    raise ValueError(f"duplicate item id {item_id}")
                seen_ids.add(item_id)
                items_out.append({"id": item_id, **item.model_dump(exclude_none=True)})
            pack_out = {
                "id": pack.slug,
                "kind": pack.kind,
                "level": pack_file.level,
                "week": pack.week,
                "title": pack.title,
                "title_en": pack.title_en,
                "items": items_out,
            }
            if pack.dialogue is not None:
                pack_out["dialogue"] = pack.dialogue.model_dump(exclude_none=True)
            packs_out.append(pack_out)
    # curriculum order: level, then week, situation packs before core decks
    packs_out.sort(key=lambda p: (p["level"], p["week"], p["kind"] != "situation", p["id"]))
    versions = sorted({pf.version for pf in pack_files})
    return {"version": versions[-1], "packs": packs_out}


def build(content_dir: Path, out_path: Path) -> dict:
    files = sorted(content_dir.glob("*/packs.json"))
    if not files:
        raise FileNotFoundError(f"no */packs.json files under {content_dir}")
    content = to_app_content([load_pack_file(f) for f in files])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(content, ensure_ascii=False, indent=1), encoding="utf-8")
    return content
