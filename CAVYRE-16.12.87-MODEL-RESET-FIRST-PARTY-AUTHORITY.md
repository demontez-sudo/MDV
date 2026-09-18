# CAVYRE 16.12.88 — Model Reset First-Party Authority

This release removes Supabase refresh-token/session dependence from the model reset page.

- New recovery emails point to `/portal/reset-16-12-87`.
- The page accepts only the signed CAVYRE `recovery_token`.
- Password finalization runs server-side through `model-password-finalize-16-12-87`.
- No browser refresh token is read, restored, exchanged, or required.
- Legacy `/portal/reset` and `/model-reset` routes are redirected to the new page.
- Reset pages are served with `Cache-Control: no-store`.
- After a verified password change, the model is sent to sign in with the new password rather than inheriting a recovery session.
