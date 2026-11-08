# Follow-up to the second audit

Review [the public application](https://github.com/HMUI-Tech/language_live) with [the private Supabase backend](https://github.com/HMUI-Tech/language_live_backend). Protected SQL stays private. The supplied second audit was read in full; no reviewer changes were overwritten.

## Implemented

| Finding | Change and evidence |
| --- | --- |
| B1: child-session scan | Private `child_sessions` table with token primary key and owner index. Transactional trigger follows start, rotation, pause, reset and profile deletion. Exit revokes the server session. A 50,000-family test checks that the lookup plan uses both primary keys. No production latency number is claimed. |
| B2: PIN fields overwritten by ordinary writes | Ordinary family writes preserve stored PIN, salt, failure count and lockout. PIN changes use an explicit `change-pin` operation. Regression tests cover attempted overwrite. |
| N1: meaning-changing accents | Per-language minimal-pair lists reject both directions of schön/schon, zählen/zahlen, dà/da and sì/si, with additional common pairs. Other missing accents retain corrective feedback. German normalization now uses NFC. The lists are deliberately bounded, not a full dictionary of every ambiguous form. |
| N2 / T1: CI and deployment drift | Materialization preflights all existing copies and rejects differences before writing. Both standalone app builds verify a source checksum manifest. Explicit `prepare:apps -- --write` refreshes intentional canonical edits. A root regression proves a broken copy is rejected and retained for inspection. CI runs formatting, strict lint, types and both production builds. |
| N3 / H5: duplicated routes | Shared modules now include family, kids, rewards and world APIs. Language time zones live in configuration. There are 70 shared files after removing unused components. Progress routes remain separate because their hosted persistence backends differ. |
| S1: linkable social IDs | Per-site secret HMACs with language domain separation. A resumable one-time D1 upgrade migrates existing profiles and all peer references before returning social data, including peers who have not signed in again. Tests retain friendships and room messages. Preserve the identity key securely; rotation needs a reviewed migration. |
| S2: internal errors | Family, kids, rewards and world expose only explicitly marked validation/conflict errors. Unexpected database, network or runtime exceptions return a generic 503. Tests prevent echoing internal messages. |
| S3: moderation ownership | `MODERATOR_USER_IDS` is an explicit comma-separated list of verified ChatGPT user IDs. Analytics owner email no longer grants moderation. Missing configuration denies moderation. |
| S4: learning headers | Worker and static-asset header configuration add CSP, nosniff, frame denial, referrer policy and capability restrictions. HTTPS adds HSTS. Static assets run through the Worker. Live German/Italian guest initialization and German lazy shop opening were checked in a browser. |
| F1–F3: economy clarity | Every item has one coin price. Completed stars can be exchanged separately at 40 coins each, with confirmation and an expected-points replay guard. Property tiers are 64–2048 coins; top activity-only coin cost is about 103 capped earning days, versus the old 1024. Collection names are Explorer/Voyager/Navigator; lifetime reward points continue beyond the nine-star collection and never fall when spending. Existing inventory and balances remain saved; earlier purchases are not retroactively refunded. |
| E3/E4: social efficiency | Friendship endpoint/status/requester indexes added through D1 migrations. Physical retention cleanup runs at most hourly during active requests; expired content is still excluded on reads. This is not guaranteed scheduled deletion. |
| E6 / H4: unused UI and readability | Removed the 61 unused UI components and unused UI package stack; five runtime dependencies remain because the framework, connector validation and D1 schema need them. Authored code is formatted and checked in CI. The analytics template is multiline. |
| B9: PIN concurrency proof | Backend CI adds a PostgreSQL 17 service and runs the existing 20-connection pgbench fixture, not just a single-connection mock. The reviewer also independently confirmed five counted failures and a lock in the second audit. |

## How to test

```sh
npm ci --ignore-scripts
npm ci --prefix apps/deutsch-live/standalone --ignore-scripts
npm ci --prefix apps/italian-live/standalone --ignore-scripts
npm run check
npm run format:check
npm test
```

The app suites contain 118 cases (60 German, 58 Italian), plus the root shared-source regression. Backend `npm ci --ignore-scripts && npm run check && npm test` runs 15 cases, including the synthetic scale plan. Both deployed app versions passed strict lint, type checks and production builds. CI independently runs the framework checks. No real family data is used in test fixtures.

## Edge cases and remaining work

Test signed-in parent/child session exit, token rotation, simultaneous child/parent updates, star-exchange confirmation and stale replay, moderator denial and explicit grant, social migration with two accounts, and account deletion across Supabase/D1/backups on staging. Guest browser smoke checks are not substitutes for those flows.

Smaller backend items remain: separate child progress revisions (B3), Italian server-to-database progress patching and scoped key rotation (B4), obsolete family_config cleanup (B5), deliberate alignment of progress DELETE grants (B6), a second API credential layer (B7), and escalating lockouts (B8). These have not been represented as fixed. Other open work includes splitting the social handler, gentler long-interval lapses/fuzz, guaranteed scheduled deletion, content-rights clearance, age assurance, moderation staffing, and observing 5–8 real learners.

The optional star exchange preserves the requested star-sacrifice feature. Collection progress can fall after exchange; lifetime rewards and language learning records do not. Meaning-changing pairs score wrong, but false-friend explanations currently use the existing expected-answer feedback rather than dictionary definitions.

## Deployment configuration

`WORLD_ID_KEY` is a distinct server secret per site and has been provisioned. Keep it stable across routine deployments. Set `MODERATOR_USER_IDS` in the hosting secret/configuration manager using verified IDs from `/api/me`; analytics emails are not IDs. Until configured, moderation intentionally denies access. Do not add identities or runtime values to Git.
