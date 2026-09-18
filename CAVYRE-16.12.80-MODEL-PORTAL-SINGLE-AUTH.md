# CAVYRE 16.12.80 — Model Portal Single Auth

## Goal
Replace the fragmented model login experience with one branded entry point:

`https://www.maisondeveux.com/portal`

## Model experience
### Normal login
Portal → Email + Password → Supabase credential verification → model_user_links authorization → session persisted → `/portal/home`

### First access
Portal → First time accessing your account? → request secure access email → setup/reset token → create password → verified session → `/portal/home`

### Forgot password
Portal → Forgot password? → recovery email → `/portal/reset` → new password → verified session → `/portal/home`

### Existing authenticated model
Account/password remains available at:
`/portal/account` → `/portal/password`

## Architectural simplification
- one public entry URL
- one canonical browser origin: `https://www.maisondeveux.com`
- one Supabase project
- one localStorage auth session origin
- one Agent Model Access backend authority
- `model_user_links` remains canonical model authorization
- no access code required
- temporary passwords remain emergency-only
- model-facing login details point to `/portal`, not `/portal/auth`

## New routes
- `/portal`
- `/portal/`
- `/portal/auth` compatibility alias
- `/portal/recover`
- `/portal/setup`
- `/portal/home`
- `/portal/account`

Existing:
- `/portal/password`
- `/portal/reset`

## Important boundary
This release now gives the Agent deployment a first-party `/portal` login owner.
`/portal/home` is currently an authenticated handoff shell because the previously separate full Model Portal application source is not present in this ZIP.

For the final production experience, the full model dashboard application should be mounted at `/portal/home` (or behind `/portal/*`) on the same `www.maisondeveux.com` origin. That preserves the verified Supabase session without another cross-domain handoff.

## Untouched
Calendar, CRM, Tasks, Packages, Season, Finance, Vera, and Model 360 profile data behavior were not redesigned in this pass.
