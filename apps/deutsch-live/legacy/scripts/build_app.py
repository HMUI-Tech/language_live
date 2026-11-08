"""Build the single-file app: validate content, then inline styles, fonts, content and scripts.

Usage:  python scripts/build_app.py            -> app/build/index.html
The output has no outside requests: fonts are embedded, content is embedded.
"""

from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline" / "src"))

from vocab_pipeline.build import build  # noqa: E402

APP = ROOT / "app"
FONTS = [  # (family, weight, style, file)
    ("Barlow Condensed", 600, "normal", "barlow-condensed-latin-600-normal.woff2"),
    ("Barlow", 400, "normal", "barlow-latin-400-normal.woff2"),
    ("Barlow", 600, "normal", "barlow-latin-600-normal.woff2"),
    ("Source Serif 4", 400, "normal", "source-serif-4-latin-400-normal.woff2"),
    ("Source Serif 4", 400, "italic", "source-serif-4-latin-400-italic.woff2"),
]


def font_faces() -> str:
    rules = []
    for family, weight, style, filename in FONTS:
        path = APP / "fonts" / filename
        if not path.is_file():
            raise FileNotFoundError(f"missing font file {path}")
        data = base64.b64encode(path.read_bytes()).decode()
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{data}) format('woff2');}}"
        )
    return "\n".join(rules)


def safe_json_for_script(obj: dict) -> str:
    """JSON that cannot close the surrounding <script> tag."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def main() -> int:
    content = build(ROOT / "content", APP / "build" / "content.json")
    template = (APP / "src" / "index.template.html").read_text(encoding="utf-8")
    styles = (APP / "src" / "styles.css").read_text(encoding="utf-8").replace("/* FONTFACES */", font_faces())
    parts = {
        "/*STYLES*/": styles,
        "/*CONTENT*/": safe_json_for_script(content),
        "/*CORE*/": (APP / "src" / "core.js").read_text(encoding="utf-8"),
        "/*GUIDES*/": (APP / "src" / "guides.js").read_text(encoding="utf-8"),
        "/*APP*/": (APP / "src" / "app.js").read_text(encoding="utf-8"),
    }
    html = template
    for marker, value in parts.items():
        if marker not in html:
            raise ValueError(f"template is missing {marker}")
        html = html.replace(marker, value)
    out = APP / "build" / "index.html"
    out.write_text(html, encoding="utf-8")
    items = sum(len(p["items"]) for p in content["packs"])
    print(f"OK: {out} ({out.stat().st_size // 1024} KB, {len(content['packs'])} packs, {items} items)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
