# CAVYRE 16.12.79 — Model Auth Consolidation

## Scope
Targeted Model Portal authentication repair only.

Untouched by this pass:
- Calendar
- CRM / Relationships data behavior
- Tasks
- Packages
- Season
- Finance
- Vera
- Model 360 profile data

## Canonical origin
All first-party Model Portal auth journeys now use exactly:

`https://www.maisondeveux.com`

This includes:
- `/portal/auth`
- `/portal/recover`
- `/portal/reset`
- `/portal/password`
- final `/portal` redirect

If an auth page is opened on bare `maisondeveux.com` or any `*.netlify.app`
host, it moves to the same path/query/hash on `www.maisondeveux.com`
before credentials/session storage are used.

## One Agent Model Access authority
`/api/agent/model-access` now routes to:

`/.netlify/functions/agent-model-access`

That canonical function is based on the stronger verified 16.12.43 behavior:
- first-party signed recovery tokens
- organization/model/user/email-bound recovery
- exact temporary credential verification against production Supabase
- model_user_links preserved
- temporary password explicitly requires permanent password change
- activation URL points to the canonical `/portal/auth`

The legacy 16.12.43 file is retained only for compatibility and contains the
same behavior.

## Account & Access URL
Known Model Account & Access authorities now direct copied model login details
through:

`https://www.maisondeveux.com/portal/auth`

rather than directly entering `/portal`.

## Diagnostic endpoint
New Agent-only endpoint:

`GET /api/agent/model-auth-diagnostic?model_id=<MODEL_ID>`

It can report, without exposing passwords/tokens/secrets:
- model link verified
- Auth identity found
- Auth email
- email confirmed
- portal disabled
- password-change-required
- temporary-password expiry
- canonical auth/portal destination

## Boundary
The actual `/portal` frontend application is still not contained in this
Agent deployment. This build fixes the Agent/auth side and prevents the
known WWW/bare/Netlify session-origin split. If the separately deployed
`/portal` frontend itself contains a hard-coded Netlify redirect, that
frontend still needs its own source/deployment repair.
