# Deutsch Live independent edition

The website is free to use; no checkout, paywall, subscription, ads or analytics is included.

## Status

- Guest learning: works without an account. Progress is memory-only; reload discards it. Export/import is unavailable for guests.
- Google and email magic links: adapters implemented, disabled until Supabase and provider credentials are configured.
- Saved progress: Supabase PostgreSQL, authenticated user ownership via RLS and server-side session identity, with revision conflict protection. Hosted migration and two-account tests remain pending.
- ChatGPT on the existing Sites version is identity only. This standalone build does not claim to connect a ChatGPT plan.
- Embedded ChatGPT plan usage: blocked pending a supported integration for this hosted website. The published open-source example uses a user-controlled local runtime. Free access alone does not remove integration eligibility or runtime requirements.
- Claude consumer sign-in/plan usage: not implemented. Do not reuse Claude Code credentials or private endpoints.
- Free role-play handoff: copy a level-appropriate scene and open ChatGPT or Claude. Their own account and limits apply; conversations do not sync back.

## Build

Run `npm ci`, then `npm test` and `npm run build` from this directory. Build output is `dist/`. The build reads the current generated learning HTML and content from `../public` and preserves all 4,616 cards.

Environment variables (public browser configuration): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `AUTH_PROVIDERS` (comma-separated subset of `google,email`). Never set a service-role key or secret key here.

## Deployment setup

1. Connect the owner's Supabase and Vercel accounts. Provision only with the owner's account; do not incur paid charges without authorization.
2. Apply `supabase/001_progress.sql` to a dedicated project. Confirm RLS and that anonymous requests cannot read or write records.
3. Enable requested providers in Supabase. Register the site with Google; store provider secrets in Supabase, not browser configuration. Configure production email delivery.
4. Set the final HTTPS site URL and exact redirect allowlist (`https://<site>/learn.html`) in Supabase. Configure provider callback URLs as instructed by Supabase.
5. Build from the repository root using `npm ci --prefix standalone && npm run build --prefix standalone`; publish `standalone/dist`. The existing Sites deployment remains a separate ChatGPT-authenticated preview.
6. Test each real OAuth flow, sign-out, email link, session expiration and two independent accounts. Confirm guest actions cause no progress writes and reload resets the session. Test stale writes from two devices before public launch.
7. Provide operator contact details, audience/age policy and a complete privacy notice; confirm redistribution rights for the supplied PDF supplement. No age eligibility is assumed from “everyone”.

## ChatGPT next step

Official integration entry points:
- https://developers.openai.com/siwc/quickstart
- https://developers.openai.com/siwc/request-client-id
- https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt

Do not submit an application, accept terms, promise availability, or collect plan credentials until the owner has reviewed the concrete registration and the intended runtime is supported.

## Current hosted integration

The public Sites edition retains native ChatGPT sign-in and uses Supabase managed authentication for Google and Email. Native ChatGPT progress remains in D1, while Supabase users save progress in `german.learning_progress`. The two account systems are intentionally not automatically linked by matching email addresses. The browser SDK verifies its own session and the database enforces ownership through RLS. No OAuth client secret is stored in Sites or browser code.

The published Google button checks Supabase provider settings and enables itself only when the provider is actually enabled. Project display name: Language Live. Site URL and exact `/learn` redirect are configured. Google Client ID/Secret and production email delivery remain pending. Google Cloud's console was unavailable in the automation browser; user must finish that provider registration directly.

Google configuration values:
- Authorized JavaScript origin: https://deutsch-live.bestaster2.chatgpt.site
- Authorized redirect URI: https://fslhuirvmgasjysggslw.supabase.co/auth/v1/callback
- Supabase redirect allowlist: https://deutsch-live.bestaster2.chatgpt.site/learn

The callback flow and a real cross-device login still require end-to-end testing after provider credentials and email delivery are available. Database ownership, stale writes, expired sessions, account switching and guest write restrictions have been checked.
