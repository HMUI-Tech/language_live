# Deutsch Live

Interactive everyday German, A1 → B2 in 26 weeks. One page that works on phone and laptop:
spaced-repetition cards, branching dialogues, shadowing, and an AI tutor (role-play + writing
correction). Progress syncs through your Claude account.

Version 0.3.0 · 4,001 words: 26 hand-written situation packs with dialogues (8 A1, 6 each for A2, B1 and B2; 520 words and chunks) plus core decks of the 3,481 most frequent spoken words, A1 to B2, built from Wiktionary. Every word has an example sentence.

## Repo layout

| Path | What it is |
| --- | --- |
| `content/{a1,a2,b1,b2}/packs.json` | Hand-written situation packs with dialogues (source of truth) |
| `content/examples/*.json` | Example sentences for core words without a short Wiktionary one |
| `content/core-a1` … `core-b2` | Generated core decks (Wiktionary data, CC BY-SA 4.0) |
| `content/exclude.txt` | Words never put in core decks; edit freely |
| `pipeline/` | Python package `vocab_pipeline`: extract lexicon, rank, build decks, cross-check, validate |
| `app/src/core.js` | Pure logic: scheduling, answer checking, targets, tutor prompts |
| `app/src/app.js` | UI, storage (account sync + device copy), audio, AI calls |
| `app/src/styles.css`, `index.template.html` | Look and page shell |
| `app/fonts/` | Self-hosted fonts (embedded at build; no font CDN) |
| `scripts/build_app.py` | Builds `app/build/index.html`, one self-contained file |
| `scripts/smoke_test.py` | Opens every screen at phone and laptop width; fails on errors or outside requests |

## Build and test

```bash
pip install -e "pipeline[dev]" playwright && playwright install chromium
python scripts/build_app.py                 # validate content + build the page
cd pipeline && pytest -q && cd ..           # 43 pipeline tests
node --test app/tests/core.test.js          # 11 logic tests (incl. all 4,001 cards answerable)
python scripts/smoke_test.py                # browser check, phone + laptop, light + dark
```

## Rebuild the word bank (no API key needed)

```bash
# 1. Dictionary: stream Wiktionary's German extract (about 1 GB) into a 22 MB lexicon (~40 s)
curl -sS https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl | vocab lexicon-extract -
# 2. Frequency: spoken German from film and TV subtitles
curl -sSLO https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
# 3. Check the hand-written packs against Wiktionary (articles, plurals)
vocab check
# 4. Build core decks up to 4,000 words (A1 800, A2 1,700, B1 2,900, B2 4,000)
vocab core-decks de_50k.txt
# 5. Build the app
python scripts/build_app.py
```

How ranking works: every token in the frequency list is folded onto its dictionary lemma
("bin", "ist", "war" → sein; "hände" → Hand). Ambiguous tokens are split in proportion to the
evidence for each lemma, so "tagen" counts mostly toward *Tag*. Case twins (*ich* / *das Ich*)
merge into the lowercase word. Vulgar, obsolete and rare senses are dropped.

Known limits of the data:
- Film and TV subtitles over-represent drama words. `content/exclude.txt` removes the worst;
  the hand-written situation packs come first in each week so everyday words lead.
- Meanings are Wiktionary's first senses, shortened. Some read like a dictionary, not a teacher.
- Example sentences: Wiktionary's where it has a short one, otherwise our own from
  `content/examples/*.json` (`"word": [German, English, better meaning?, part of speech?]`).
  `vocab core-decks` checks each one (word or a form of it present, capital letter, end
  punctuation, max 90 characters) and prints `example skipped: …` for any that fail.
- `vocab check` currently reports 24 differences, all reviewed and fine: 18 compounds or
  plural-only words Wiktionary has no entry for (*Eigenbedarf*, *Lösungsvorschlag* …),
  *das Gehalt* (salary; Wiktionary leads with *der Gehalt*, content), *die Kopfschmerzen*
  taught as plural, *Euro* (we teach "zwei Euro") and *Geschwister* (plural-only).

## How the AI tutor works

The page asks Claude directly through the viewer's own Claude account, so there is no API key
in the page. It runs only when the page is opened inside Claude (app or claude.ai, signed in).
Cards, dialogues and listening work without it. Speaking: the page cannot use the microphone,
so use the dictation mic on your phone or laptop keyboard.

## Licences

Fonts: Barlow, Barlow Condensed, Source Serif 4, all SIL Open Font License 1.1 (see `app/fonts/`).
Hand-written packs (`content/a1` to `content/b2`) and `content/examples` are original. Core decks are derived from Wiktionary
(via kaikki.org) and the FrequencyWords list, both CC BY-SA 4.0: credit them, and keep derived
word lists under the same licence. The app credits both on the Progress screen.

## Not done yet

- Placement test and phase-gate mock exams.
- Server backend from the build plan: not needed while the page runs inside Claude; add it only
  if the app is sold as a standalone product (then also add Impressum, privacy policy, consent).
