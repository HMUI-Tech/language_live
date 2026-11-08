# Audit status and remaining work

This is an engineering review, not an independent security, legal or educational certification. See `SOURCE_SNAPSHOTS.json` for the exact deployed source commits exported to GitHub.

## Verified in automated checks

- Real browser learning rules, article errors, typo grades, bounded review queues and retryable catalogue loading.
- Existing progress round-tripping, content IDs and linked assets.
- Fixed server-side prices, saved wallet ownership, duplicate purchases and concurrent-write conflicts.
- Separate Kids economy and denied access to social endpoints.
- Invitations, mutual friend acceptance, same-age-band access, private-club ownership, blocks, reports and moderator authorization against a real in-memory SQLite database.
- Message length/contact-detail restrictions, rate limits, expiry and disabled calling.

Run `npm run check` and `npm test` from the root after the documented test dependencies are installed. Build both applications separately for production. Browser and signed-in production walkthroughs are separate verification steps; a passing test suite does not establish that every real OAuth/provider/hosting configuration works.

## Remaining limitations to review

1. **Age assurance:** age bands are self-declared and saved; they are not identity-verified. An account cannot switch its band itself. A correction or transition to the next band needs operator support. Stronger age assurance and a proportional assessment of risks to 16–17-year-olds remain business/product work.
2. **Moderation operations:** a report inbox, hide and suspend controls exist, but the operator must actively review them. There is no staffed response service, automated safety classifier, notification delivery or documented response-time guarantee. Block/report controls do not make abuse impossible.
3. **Learning-event trust:** the server owns wallet totals, prices, caps and replay checks, and grades reading answers. Some card/game success events are still reported by the browser; the server cannot prove that a human learned or answered honestly. Do not use coins for money, prizes or valuable entitlements without server-issued challenges and stronger anti-abuse controls.
4. **Content rights:** preserve the existing data/font notices. The German PDF-derived vocabulary supplement has unresolved redistribution permission in the original credits; replace it or obtain permission. There is no blanket licence for all included content.
5. **Private backend review:** protected Supabase source is deliberately excluded from the public tree and saved in access-controlled Site source. A separate private GitHub repo still requires owner creation and access grants; see BACKEND_ACCESS.md. Independently validate migration completeness and backup/restore before a fresh installation. D1 social migrations remain public.
6. **Retention and privacy:** message/report expiry filters apply on reads. Physical cleanup is triggered by subsequent active social requests, not a guaranteed background deletion schedule. Provider backups can retain data beyond the active database. Validate export/deletion and provider arrangements for the actual markets served.
7. **AI, speech and learning claims:** embedded AI is not connected by default; browser audio is not a proficiency test. Validate content and learner outcomes before marketing a guaranteed CEFR level or completion time.

There are no subscriptions, marketing-email flows, payment processing or session-replay features added by this update. Reassess their safeguards if introduced. Account/operator contact information and applicable business/legal registrations require the operator's own review.

## Public-export sanitization

This export replaces operator contact details with configuration placeholders and omits deployed Site identifiers. These substitutions are intentionally different from the deployed source commits recorded in `SOURCE_SNAPSHOTS.json`. Do not deploy the legal placeholders as a completed legal notice. Earlier commits may retain earlier public snapshots; this update does not rewrite Git history. Licence and third-party attribution notices remain in place.

## Follow-up validation, 8 November 2026

Both app test suites pass (55 German, 53 Italian). TypeScript, strict ESLint and both production builds passed. A separate PostgreSQL concurrency regression verified atomic PIN lockout. Italian privacy country/voice text is corrected. Accent-only answers receive corrective feedback and a bounded grade. Stars fill progressively, mistakes reduce bounded partial progress in the adult economy, and star purchases lower only the reward stage. Children do not lose star progress for mistakes. Optional asset loading and changed-document sync reduce unnecessary transfer.

Production publication succeeded for both Sites. A signed-in browser walkthrough was not completed; direct HTTP checks were blocked by the hosting access layer. Age assurance, moderation staffing, content rights and business/legal review remain as described above. These changes are not legal certification.
