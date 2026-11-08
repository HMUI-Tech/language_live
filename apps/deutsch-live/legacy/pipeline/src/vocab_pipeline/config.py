"""All pipeline settings, read from environment variables with safe defaults.

Nothing else in the package reads os.environ, so tests can build a Settings
object directly and never depend on the machine they run on.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    content_dir: Path
    app_content_path: Path
    lexicon_path: Path

    @classmethod
    def from_env(cls) -> "Settings":
        def env(name: str, default: Path) -> Path:
            return Path(os.environ.get(name, str(default)))

        return cls(
            content_dir=env("DL_CONTENT_DIR", REPO_ROOT / "content"),
            app_content_path=env("DL_APP_CONTENT", REPO_ROOT / "app" / "build" / "content.json"),
            lexicon_path=env("DL_LEXICON", REPO_ROOT / "data" / "lexicon.jsonl"),
        )
