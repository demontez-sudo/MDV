# CAVYRE 16.12.96 — Model Access Route Authority

Root cause: `public/_redirects` still had higher-priority legacy rules routing `/portal/password`, `/portal/reset`, `/portal/recover`, and `/model-reset` to the old `portal-password.html`. Those rules overrode the clean-room routes in `netlify.toml`, so the old Supabase refresh-token page continued to render.

16.12.96 makes `/portal/access.html` the single model-auth surface across both `_redirects` and `netlify.toml`, and replaces physical legacy password/reset HTML copies with the clean access page.
