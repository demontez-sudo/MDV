# CAVYRE 16.12.89 — Temporary Password Authority

Temporary-password testing is now explicitly separated from recovery-email/password-reset flows.

## Correct temp-password flow
1. Agent generates a temporary password on the model profile.
2. Model opens `/portal?flow=temp` and signs in with email + temporary password.
3. `model-auth-login` verifies the exact temporary credential.
4. If `cavyre_temporary_login_ready` or `cavyre_password_reset_required` is set, login returns `/portal/password?email=...&flow=temp`.
5. The model enters the temporary password again plus a new permanent password.
6. `/api/model/password/direct-change` verifies the temporary password, updates Supabase Auth server-side, verifies the new password, and clears the temporary-password flags.

This flow does not use `refresh_token`, recovery links, `exchangeCodeForSession`, `verifyOtp`, or browser recovery sessions.

The `Forgot password?` / reset-email route remains a separate recovery mechanism and must not be used to test a generated temporary password.
