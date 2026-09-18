# CAVYRE 16.12.93 — Model Password System Rebuild

This release replaces the accumulated Model Portal password/reset patches with one password authority.

## One authority
- `POST /api/model/password`
- Server function: `netlify/functions/model-password-authority.mjs`
- Actions: `login`, `change_current`, `request_recovery`, `recover`

## Temporary-password flow
1. Agent generates a temporary password.
2. Model opens `/portal/password?mode=temp` or signs in normally.
3. Temporary password is verified server-side.
4. Model chooses a permanent password.
5. Password is updated and immediately verified against Supabase Auth.
6. Only then is a fresh session returned and stored.

No recovery token, reset-email session, browser `getSession()`, `refreshSession()`, `setSession()`, `exchangeCodeForSession()`, or `verifyOtp()` is used for temporary-password setup.

## Forgot-password flow
1. Model enters portal email.
2. CAVYRE sends a signed first-party recovery link.
3. Link opens `/portal/password?mode=recovery&recovery_token=...`.
4. Server validates the CAVYRE token, model link, organization, and account.
5. Password is changed, verified, and a fresh session is returned.

## Compatibility
Older endpoints now delegate to the new authority:
- `/api/model/auth/login`
- `/api/model/password/direct-change`
- `/api/model/password/change`
- `/api/model/password/recovery`
- old finalize endpoints

Older password/reset pages route into the new Password Center.

## Agent-side changes
- Temporary-password activation URL now points directly to `/portal/password?mode=temp`.
- Copy-login instructions tell the model to use the Password Setup page directly.
- Agent access authority release is 16.12.93.

## Deployment verification
The deploy script verifies the live custom domain contains both visible release markers:
- `MODEL AUTH 16.12.93`
- `PASSWORD 16.12.93`
