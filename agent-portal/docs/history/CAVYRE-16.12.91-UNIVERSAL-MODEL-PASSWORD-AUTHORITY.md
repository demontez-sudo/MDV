# CAVYRE 16.12.91 — Universal Model Password Authority

Root cause confirmed from the screen recording: temporary-password login succeeds, but the handoff reaches a legacy two-field reset surface. That surface still belongs to the recovery architecture and can surface a stale Supabase refresh-token error.

16.12.91 removes the route ambiguity. `/portal/password`, `/portal/reset`, `/model-reset`, legacy reset HTML files, and directory-backed reset routes all serve one password authority. If a genuine signed recovery token is present it uses recovery. Otherwise it always uses email + temporary/current password + new password and calls the server-side direct-change endpoint. Temp mode never calls Supabase browser session restoration, refresh, `getSession`, `setSession`, `refreshSession`, or `updateUser`.
