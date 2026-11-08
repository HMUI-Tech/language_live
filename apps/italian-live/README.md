# Italian Live

A separate Italian learning website, built from the Deutsch Live interface.

- Shared Supabase project: Language Live (`fslhuirvmgasjysggslw`).
- Italian progress: `italian.learning_progress` for Supabase identities; `italian.site_progress` for Sites ChatGPT identities.
- The Sites backend verifies ChatGPT identity and uses a server-only secret to call a narrowly scoped Italian progress gateway. No D1 database is used.
- German tables, site identity and source are unchanged.
- Public guest learning; guest progress is in memory only.
- 4,000 dictionary headwords plus 208 original dialogue phrases; 26 situations; 18 article patterns; 4,000 English–Italian spelling bridges.

## Authentication configuration

Add `https://italian-live.bestaster2.chatgpt.site/learn` to Supabase Authentication → URL Configuration → Redirect URLs, preserving the German URLs and the existing Site URL. Then set `AUTH_REDIRECT_READY=true` in Italian Live runtime variables and deploy to enable Google/email buttons. Real Google/email sign-in and email delivery still require testing. The shared Google OAuth callback remains the Supabase callback already configured for this project.

Runtime values: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ITALIAN_BRIDGE_SECRET. The last value must stay server-only. `.openai/hosting.json` contains no secrets.

## Validation

`node --test tests/italian.test.mjs` checks content structure, unique IDs, apostrophes, articles, speech locales, word filters, pagination and failed-load recovery. Database tests use rollback transactions for account isolation, revision conflicts, guest rejection and the Sites gateway. Production guest article/search/dialogue paths were checked in the browser. Actual microphone capture and completed sign-ins remain device/user tests.

## Content

Dictionary adaptations: Wiktionary via Kaikki/Wiktextract, CC BY-SA 4.0. Per-entry source links, selected input entries, adaptation script and original scenario text are downloadable from Sources & licences. Dictionary CEFR labels are frequency study bands, not assessed proficiency levels. The AI tutor remains unconnected, as in Deutsch Live. Legal pages carry the same operator details; they do not establish a completed legal review.

## Aggregate owner analytics

Open `/analytics` and sign in with the operator’s ChatGPT account. Both sites appear on either dashboard. `USAGE_OWNER_EMAIL` is checked against the platform-verified identity; Google/email learner sign-in does not grant dashboard access. Shared daily counters live in the `analytics` schema in Language Live. `USAGE_SERVER_KEY` stays server-only; public clients cannot read totals or write directly. No visitor identifiers or event history are recorded. Totals retain 180 days, Europe/Berlin; old rows are purged on the next event and excluded from summaries.

Browser counters use memory only, respect DNT/GPC, and send finite categories. Opens and learning starts are not unique users, retention, signups, or lesson completion. Reloads, bots, blockers, own testing and lost requests affect the figures. A same-origin check and known-bot filter reduce noise but do not make counts abuse-proof.

Run `node --test tests/usage.test.mjs`. Database checks validate secret scoping, denied client reads, atomic increments, event validation and retention in rollback transactions.
