# Second audit: review both repositories

| Repository | Scope | Access |
| --- | --- | --- |
| [language_live](https://github.com/HMUI-Tech/language_live) | Learning UI, domain rules, server callers, D1 social data, shared modules and app tests | Public |
| [language_live_backend](https://github.com/HMUI-Tech/language_live_backend) | Supabase tables, all 22 live functions, RLS, grants, database tests and operations | Private; grant auditors read access |

The live German and Italian Sites were updated in the previous app commit. This handoff adds the complete schema-only backend capture and documentation; it does not change live application behavior. `SOURCE_SNAPSHOTS.json` identifies the deployed source. The backend source manifest identifies the reviewed app baseline; review subsequent documentation-only changes separately.

## How to test

Public app repository (Node.js 22.13+):

```sh
npm ci --prefix apps/deutsch-live/standalone --ignore-scripts
npm ci --prefix apps/italian-live/standalone --ignore-scripts
npm run check
npm test
```

The root scripts materialize 121 shared source files into both apps. Edit shared originals under `packages/shared/runtime/`. Language-specific content, answer checking and configuration remain local. For framework checks, install each app's declared pnpm dependencies and run `pnpm typecheck`, `pnpm lint -- --max-warnings 0` (or `pnpm exec eslint . --ignore-pattern dist --ignore-pattern .next --max-warnings 0`), and `pnpm build`. Both apps passed equivalent strict checks and production builds in the preceding deployment. Browser/OAuth testing is a separate step.

Private backend:

```sh
npm ci --ignore-scripts
npm run check
npm test
```

The 12 backend database cases replay a clean schema into an isolated PostgreSQL engine with pgcrypto. Test auth helpers stand in for Supabase-managed auth; no production credentials are needed. Use `ops/verify-live.sql` only in an authorized admin session for a read-only check of all 22 live function definitions. Do not replay the baseline onto production.

## Edge cases and expected outcomes

| Area | Review scenario | Expected outcome |
| --- | --- | --- |
| Parent security | Parallel wrong PIN attempts; correct PIN during lock; expired lock | Attempts count atomically; fifth failure locks; correct PIN cannot bypass active lock |
| Access | Missing/wrong key; rewards key used for family; direct private-table SELECT | Access denied; no profile/key/wallet data returned |
| Identity | Two account sessions; anonymous session; child cookie sent to adult endpoint | No cross-user progress, anonymous account writes or child social access |
| Correctness | Repeated award/purchase; stale wallet/progress revision | No duplicate unlock or overwrite; conflict is visible |
| Sync | One card chunk changes; unchanged save; deletion of required meta/custom | Only changed chunks transmitted; no-op skipped; required data preserved |
| Learning | Italian `citta` for `città`; German missing umlaut | Meaning recognised with corrective accent feedback and bounded grade |
| Loading | Open first lesson; later open reading/shop; script fails then retry | Optional sections load on demand; learning remains available; retry is explicit |
| Stars | Cross threshold; adult mistakes; child mistakes; sacrifice stars | Percentage and reward stage update; adult loss bounded; no child mistake loss; completed stars only can be spent |
| Social | Unaccepted friend; wrong age cohort; expired club invitation; blocked user | Message/join access denied; reporting and operator authorization enforced |
| Privacy | Fonts, replay, calls, exports/deletions, provider backups | Fonts self-hosted; no replay/calls; validate deletion across all separate storage systems |

## Reward economy to review

There are three stars per reward stage and nine in total. These stages describe spendable rewards, not assessed language mastery. Thresholds in star points are **100, 240, 420, 660, 980, 1400, 1940, 2620, 3460**. Later stars require more work. Each star displays its own percentage.

A distinct eligible daily activity adds two points; the daily goal adds 25; a first perfect story adds ten. Gains are capped at 150 points/day. Adults can lose two points for a word mistake and five for an imperfect story, with replay guards and a ten-point daily loss cap. Children do not lose progress for mistakes. Completed stars can buy catalog items through an explicit confirmation; spending lowers the reward stage and preserves the fraction of the next star at the lower tier. Learning records are retained.

At 20 distinct eligible activities/day, the normal adult goal yields 65 star points before story bonuses: approximately two days for the first star and 54 days to all nine from zero if there are no losses or spending. This is an arithmetic illustration, not a promised completion time. The cap permits faster progress with additional varied activity. Adult coins share a 20/day cap; item coin prices and alternative star costs are visible in the catalog. Profile styles, outfits, vehicles, property and social passes are optional. Children have a separate catalog.

For the fun review, test whether the first reward feels attainable, percentage changes are understandable, spending consequences are clear, and mistake deductions discourage practice. These require human learner testing; automated tests do not establish that the economy is enjoyable or effective.

## Remaining limits

Some success events are browser-reported. Coins have no cash value and cannot be transferred. Age bands are self-declared; moderation requires an operator. Calling is disabled. Signed-in end-to-end production testing, content-rights clearance, deletion/backup verification, actual learner outcomes, and jurisdiction-specific legal/business review remain outstanding. The private backend audit lists current advisor findings and the bearer-key threat model. Review repository collaborators and branch controls through GitHub administration; private visibility alone does not establish those settings.
