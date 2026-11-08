# Language Live

Free German and Italian learning websites with adult learning, guided reading, games, virtual rewards, and a separate family experience.

**Created by Hilary Martins-Udeze.** This portfolio repository brings the two deployed applications together in one monorepo.

| App | Live website | Source |
| --- | --- | --- |
| Deutsch Live | https://deutsch-live.bestaster2.chatgpt.site | [apps/deutsch-live](apps/deutsch-live) |
| Italian Live | https://italian-live.bestaster2.chatgpt.site | [apps/italian-live](apps/italian-live) |

## What it demonstrates

- Full-stack web development with a responsive interface and bilingual navigation.
- Vocabulary/content pipelines, curated learning packs and dictionary-derived datasets with provenance notices.
- PostgreSQL/Supabase integration, schema separation, ownership checks and revision-aware progress writes.
- Parent-managed profiles, PIN-gated family access, short-lived child sessions and guest play.
- Server-validated virtual reward wallets, duplicate-award protection and learning achievements.
- Aggregate usage counters, server-only credentials and privacy-conscious child-mode boundaries.
- Automated tests for reading content, navigation, games, rewards, analytics and family APIs.

## Learning features

Each app includes flashcards, speaking prompts, grammar/article practice, English word bridges, games, a rewards shop and progress tracking. Reading comprehension provides **40 stories per language: 10 each at A1, A2, B1 and B2**, with 7–15 sentences and three questions per story. Kids mode and the parent area are separate routes within each app.

Coins are fictional, non-transferable in-app rewards. They do not represent money, cryptocurrency or an investment. Some external AI role-play links are available; a paid AI subscription is not embedded in this app.

## Repository layout

```text
apps/
  deutsch-live/       German app, server routes, content, tests and earlier pipeline
  italian-live/       Italian app, server routes, content and tests
scripts/
  test.mjs            Runs the two applications' core Node test suites
SOURCE_SNAPSHOTS.json Original source commits used for this export
```

Inside each app:

| Path | Purpose |
| --- | --- |
| `public/` | Learning interface, scripts, styles, fonts, dictionaries and printable rewards |
| `app/` | Vinext routes, authentication adapters and server endpoints |
| `lib/` | Family, reward and analytics server logic |
| `db/`, `drizzle/`, `standalone/supabase/` where present | SQL source available in the original project |
| `tests/` | Node test suites |
| `scripts/content/` | Content generation and dictionary adaptation tools |
| `standalone/` | Earlier independent deployment experiment; see its own README |
| `STARTER.md` | Original framework documentation and historical notes |

The apps are intentionally kept as independent source snapshots. A future refactor could extract common UI and domain modules; this export does not silently change the live applications.

## Run locally

Requires Node.js **22.13 or newer** and the package manager declared in each app's `package.json` (`pnpm`). Work from an app directory:

```sh
cd apps/deutsch-live
pnpm install --frozen-lockfile
pnpm dev
```

Use `apps/italian-live` for the Italian app. Open the local URL printed by the development server. Build with `pnpm build`. The framework, Worker entrypoint and Sites hosting integration are included. The existing `.openai/hosting.json` files identify the original deployments; **do not reuse those project IDs to deploy a fork**.

The browser learning UI can be explored as a guest. Guest progress is held in memory and resets on reload. Account sync, analytics, family storage and persistent rewards need your own configured backend and secrets; running the UI alone does not provision them.

## Backend configuration

Environment variables are read by server routes. Never commit their values. See each app's `.env.example`. Configure actual secrets in your deployment platform, and keep public browser configuration limited to the Supabase URL and publishable key.

The deployed applications use separate `german` and `italian` schemas in one Supabase project, with shared aggregate analytics. SQL files in this snapshot do **not** constitute a complete, ordered migration history for every production family/reward function. A fresh production installation requires completing and reviewing that schema setup, provider configuration and RLS. No database rows, user accounts, child profiles, PINs, production secrets or database backups are included.

ChatGPT identity on the hosted Sites edition is supplied by its hosting platform. A generic deployment must provide its own trusted authentication integration; it must not trust client-supplied identity headers.

## How to test

From the repository root:

```sh
node scripts/test.mjs
```

Before the first run, install the test bundler for both apps:

```sh
npm ci --prefix apps/deutsch-live/standalone --ignore-scripts
npm ci --prefix apps/italian-live/standalone --ignore-scripts
```

This runs both apps' root `tests/*.test.mjs` suites. Tests use Node's built-in runner and esbuild from each app's standalone dependencies. The standalone experiment has its own dependency installation and test command in its README. Build each app separately with `pnpm build` after installing its dependencies. Real OAuth providers, cross-device persistence and hosted configuration still need integration testing against your own environment.

Edge cases covered by the suites include invalid imports, missing configuration, repeated rewards, stale progress revisions, expired sessions, parent PIN lockout, guest boundaries, reading score limits and keyboard drawer navigation. Passing unit tests is not proof of production security or legal compliance.

## Content and third-party notices

Keep all existing notices under each app's `public/credits.html`, dictionary source archives, font licence files and vendored component licences. German dictionary-derived bridges include Ding data licensed GPL-2.0-or-later; other vocabulary includes Wiktionary/Kaikki-derived CC BY-SA material. Italian dictionary adaptations use CC BY-SA 4.0. Fonts include SIL Open Font License notices.

The original German project also contains a user-supplied PDF-derived vocabulary supplement. Its existing credits flag redistribution permission as unconfirmed. Review that material and resolve permission or replace it before redistributing or launching your own fork. No blanket licence is applied to all files: their respective notices and rights continue to apply.

## Export scope

This is a source-code portfolio export of the two live apps as recorded in `SOURCE_SNAPSHOTS.json`. It includes the current code, tests, authored assets, available SQL, content sources and German legacy pipeline. Installed dependencies, build caches, runtime state and Git history are excluded. Production analytics credential hashes have been removed from the exported SQL. The live websites are not connected to automatic deployment from this repository.
