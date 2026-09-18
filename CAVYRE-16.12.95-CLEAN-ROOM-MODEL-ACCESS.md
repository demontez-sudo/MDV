# CAVYRE 16.12.95 — Clean-Room Model Access

This release isolates model authentication from the legacy reset surfaces.

- One entry point: `/portal/access`
- `/portal` serves the same clean access page.
- Temporary password setup uses server-side credential verification and forces a fresh login after changing the password.
- Recovery uses a signed CAVYRE recovery token and forces a fresh login after changing the password.
- Legacy password/reset/auth URLs are reduced to redirects into `/portal/access`.
- The clean access page does not load the legacy Model Portal runtime or Supabase browser recovery APIs.
- Fresh normal login stores only the new session returned after direct credential verification.

Release markers: MODEL ACCESS 16.12.95 / AGENT 16.12.95.
