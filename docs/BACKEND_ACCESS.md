# Backend source access

GitHub does not support private folders inside a public repository. This public repository therefore excludes Supabase provisioning SQL, private database-function implementations and protected backend source. Application routes and non-secret RPC names remain reviewable here. The Cloudflare D1 social migrations are separate application schema and remain public.

Protected Supabase source is now maintained in [HMUI-Tech/language_live_backend](https://github.com/HMUI-Tech/language_live_backend), verified **private** before upload. It includes schema-only tables, all 24 live function implementations, policies, permissions, a clean replay test and operator documentation. Authorized reviewers need explicit access to that repository as well as this public application source. Runtime credentials, credential hashes and user rows are excluded from both repositories.

Runtime family and rewards keys are distinct for each language and capability and are stored as secret deployment variables. The previously shared bridge keys have expired. Direct table access is denied using revoked grants and RLS; server-only key checks protect the bridges. Repository privacy supplements these controls and does not replace them.

Parent PIN failures are counted while holding the account row lock. In an isolated PostgreSQL regression, 20 simultaneous incorrect attempts counted five failures, locked the account and rejected the next 15 attempts. No real family profile was used; the test schema was removed.

Historical Supabase SQL, including analytics and Italian gateway setup scripts, was removed from the current public tree. Previous commits and existing clones may still contain previously published files. This change does not rewrite history or make already-published source private. Any credential ever published must be rotated; deleting a file is insufficient.

## Verification

Run `npm run check` and `npm test`. The export check rejects protected backend directories. Confirm the private repository has private visibility and review its collaborators before uploading protected source. Confirm that production deploy archives exclude backend source, and keep credentials exclusively in the secret manager.
