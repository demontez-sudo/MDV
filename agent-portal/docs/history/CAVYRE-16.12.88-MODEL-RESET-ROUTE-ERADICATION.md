# CAVYRE 16.12.88 — Model Reset Route Eradication

Root cause confirmed from live console evidence:
- the legacy Model Portal was still attempting a Supabase refresh-token grant (HTTP 400),
- dozens of retired Model Portal CSS assets were still referenced and returning 404,
- multiple reset aliases still resolved to the 16.12.86 reset page even after the 16.12.88 page was added.

16.12.88 removes the ambiguity instead of layering another redirect on top:
- every reset alias physically serves the same first-party CAVYRE reset page,
- all legacy Supabase refresh-token logic is removed from those files,
- a versioned first-party finalize function is the only password-change authority,
- reset success returns to sign-in and does not return/persist a refresh token,
- legacy Model Portal CSS paths are present as compatibility stubs so stale HTML no longer floods the console with 404s,
- directory-backed reset routes are included so the page works even when redirect processing is bypassed,
- visible marker: `RESET 16.12.88` and footer `Recovery 16.12.88 · FIRST-PARTY`.
