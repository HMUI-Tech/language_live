"""Browser smoke test: open every screen at phone and laptop width, run a short card
session, and fail on any console error or outside network request.

Usage:  python scripts/smoke_test.py [--shots DIR]
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "app" / "build" / "index.html"
SKELETON = (
    '<!doctype html><html><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{color-scheme:light}body{margin:0}[hidden]{display:none!important}</style>"
    "</head><body>{}</body></html>"
)
VIEWPORTS = {"phone": (390, 844), "laptop": (1280, 860)}
TABS = ["Heute", "Karten", "Sprechen", "Tutor", "Fortschritt"]


def run(shots: Path | None) -> list[str]:
    problems: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        page_file = Path(tmp) / "index.html"
        page_file.write_text(SKELETON.replace("{}", PAGE.read_text(encoding="utf-8")), encoding="utf-8")
        url = page_file.as_uri()
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for name, (w, h) in VIEWPORTS.items():
                for scheme in ("light", "dark"):
                    ctx = browser.new_context(viewport={"width": w, "height": h}, color_scheme=scheme)
                    page = ctx.new_page()
                    tag = f"{name}/{scheme}"
                    page.on("console", lambda m, t=tag: m.type == "error" and problems.append(f"{t} console: {m.text}"))
                    page.on("pageerror", lambda e, t=tag: problems.append(f"{t} pageerror: {e}"))
                    page.on("request", lambda r, t=tag: (not r.url.startswith(("file:", "data:", "blob:"))) and problems.append(f"{t} outside request: {r.url}"))
                    page.goto(url)
                    page.wait_for_selector(".blocks")
                    for tab in TABS:
                        page.get_by_role("button", name=tab, exact=True).click()
                        page.wait_for_timeout(150)
                        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                        if overflow > 1:
                            problems.append(f"{tag} {tab}: page scrolls sideways by {overflow}px")
                        if shots and scheme == "light":
                            page.screenshot(path=str(shots / f"{name}-{tab.lower()}.png"))
                    # card session: learn a word, then answer its test correctly
                    page.get_by_role("button", name="Karten", exact=True).click()
                    page.get_by_role("button", name="Start session").click()
                    for _ in range(6):
                        if page.get_by_role("button", name="Got it").count():
                            page.get_by_role("button", name="Got it").click()
                        elif page.locator("#answer").count():
                            page.fill("#answer", "xyz")
                            page.get_by_role("button", name="Check").click()
                            page.get_by_role("button", name="Good").click()
                        page.wait_for_timeout(80)
                    if shots and scheme == "light":
                        page.screenshot(path=str(shots / f"{name}-session.png"))
                    reviews = page.evaluate("JSON.parse(localStorage.getItem('deutsch-live:v1') || '{}')")
                    page.wait_for_timeout(1500)
                    saved = page.evaluate("JSON.parse(localStorage.getItem('deutsch-live:v1') || 'null')")
                    if not saved or not any(k.startswith("cards-") for k in saved):
                        problems.append(f"{tag}: progress was not saved locally ({reviews})")
                    # dialogue: answer every step correctly
                    page.get_by_role("button", name="Sprechen", exact=True).click()
                    content = page.evaluate("JSON.parse(document.getElementById('dl-content').textContent)")
                    first = next(p for p in content["packs"] if p.get("dialogue"))
                    for step in first["dialogue"]["steps"]:
                        right = next(o["de"] for o in step["options"] if o["ok"])
                        page.get_by_role("button", name=right, exact=True).click()
                    if not page.get_by_text("right first time").count():
                        problems.append(f"{tag}: dialogue did not finish")
                    ctx.close()
            browser.close()
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shots", type=Path)
    args = parser.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    problems = run(args.shots)
    for line in problems:
        print("FAIL", line)
    print("OK: no errors" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
