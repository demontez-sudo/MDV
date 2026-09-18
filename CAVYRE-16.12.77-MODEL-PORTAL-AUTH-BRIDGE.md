# CAVYRE 16.12.77 — Model Portal Auth Bridge

New canonical entry points:
- `/portal/auth`
- `/portal/recover`
- `/api/model/auth/login`

Login verifies exact production Supabase credentials and canonical organization-scoped `model_user_links` before opening the portal. Temporary/reset-required accounts are routed to `/portal/password`. Forgot Password uses CAVYRE `/api/model/password/recovery` and `/portal/reset`.

This release does not claim to rewrite the separate external `/portal` frontend internals; it supplies a verified first-party authentication bridge into that app.
