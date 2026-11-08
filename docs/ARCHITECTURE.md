# Architecture and audit map

The repository holds two independently deployable applications. German and Italian retain separate content, answer normalization and pronunciation settings. Do not consolidate these language-specific rules with blind search-and-replace.

| Layer | Canonical source inside each app | Responsibility |
| --- | --- | --- |
| Learning shell | `public/learn.html`, `learning.css` | Small HTML document and self-hosted fonts |
| Content loading | `public/learning-content.js`, `content.json` | Fetch and validate the single vocabulary catalogue, show a retry without replacing progress |
| Learning rules | `public/learning-core.js` | Answer checking, recall grading, bounded session planning, spaced repetition and calendar targets |
| Learning interface | `public/learning-app.js`, `learning-guides.js` | Practice screens, audio, account progress and original language notes |
| Games and reading | `public/play-*`, `reading-*` | Curated games and story comprehension, separate from the main card queue |
| Rewards | `public/rewards-core.js`, `app/api/rewards`, `lib/rewards.mjs` | Deterministic economy and server-owned account balances with revision checks |
| Social world | `public/world-ui.js`, `app/api/world`, `lib/world.mjs` | Opt-in 16+ profiles, invitations, friends, clubs, plain-text messages and reports |
| Child experience | `app/api/family`, `app/api/kids`, `lib/family.mjs`, `public/kids*` | Parent-managed profiles, short-lived child sessions, separate rewards and no social world |
| Main persistence | `app/api/progress`, Supabase bridges | Learning and reward data in separate German/Italian schemas |
| Social persistence | `db/schema.ts`, `drizzle/` | Per-site Cloudflare D1 tables and ordered migrations |
| Analytics | `app/api/usage`, `lib/usage.mjs` | Bounded aggregate counts, owner-only dashboard |

Production source is under `public/`, `app/`, `lib/`, `db/` and `drizzle/`. `legacy/` and `standalone/` are historical experiments, not the canonical implementation. The historical Italian UI adaptation script is intentionally guarded against overwriting the modular layout.

The HTML loads the content helper, dependencies, learning rules and notes before the application. The application fetches `content.json` once on startup; that file is the only active vocabulary catalogue. Fonts are served from `public/fonts`, with their existing licences. No third-party font requests are added.

## Data boundaries

Identity is resolved server-side. Browser-supplied account identifiers, prices, coin balances, age claims in social requests and moderation flags do not grant access. Reward purchases use saved inventory and balance, not values supplied by the browser. Child sessions use a separate scoped cookie and cannot enter the main-account or social endpoints.

Main learning progress and coins use Supabase; the social world uses each site's D1 binding. There is no cross-language friend directory or coin transfer. Acquiring a pass and activating its associated social feature are separate operations: ownership is checked again on social requests. Creating a club is idempotent and limited to one clubhouse per account.

## Shared source and private backend

`packages/shared/runtime/` is canonical for 121 identical source files. The validated manifest and `scripts/materialize-shared.mjs` copy them to the original app-relative paths before tests or development, preserving module resolution. Language-specific content, normalization and configuration remain per app. Independently hosted Sites use the materialized source.

Protected Supabase source is kept outside the public repository and deployment assets. See [backend access](BACKEND_ACCESS.md). Family and rewards bridges have separate server credentials. PIN attempts use database row locks. Progress uploads send changed document chunks after acknowledgment; revision checks still reject conflicting device writes. Reading, shop and game interfaces load on demand.
