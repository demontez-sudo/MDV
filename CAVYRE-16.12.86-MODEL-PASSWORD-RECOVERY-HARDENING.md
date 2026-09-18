# CAVYRE 16.12.88 — Model Password Recovery Hardening

## Root cause
The Model Portal still had legacy Supabase recovery paths that could attempt to restore a browser session from a refresh token. When an older or already-consumed reset link was opened, Supabase returned `Invalid Refresh Token: Refresh Token Not Found` before the model password could be changed.

## Recovery authority
16.12.88 makes model password reset a server-verified operation and removes the browser refresh token as a dependency.

- Current Agency reset emails use a CAVYRE signed, single-use-style recovery credential and `/api/model/password/finalize`.
- Legacy Supabase reset links are accepted through `/api/model/password/finalize-compat` when they contain either a verifiable access token or recovery token hash.
- The reset page never initializes a persistent Supabase browser client before password finalization.
- Stale stored Model/Agent auth tokens are cleared before a reset is finalized.
- `/admin`, `/portal/password`, `/portal/auth`, and old `/model-reset` entry points redirect recovery traffic into the dedicated reset page before legacy runtime code can consume a refresh token.
- Recovery pages are `no-store` to prevent an older password page from being served from cache.

## Samuel / existing links
If the exact reset link has already expired or its only credential is a missing/invalid refresh token, it cannot safely be resurrected. After 16.12.88 is deployed, send Samuel a new reset email from Account & Access and use only the newest link.
