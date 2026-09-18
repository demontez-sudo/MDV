# CAVYRE 16.12.97 — Model Auth Entry Rebuild

Structural changes:
- `/portal` now serves the clean access authority, not the legacy model app.
- Successful login opens `/portal/home.html` directly.
- All model password/reset aliases serve the same access authority.
- Agent temporary-password links point to `/portal/access.html?mode=temp`.
- Old model recovery interceptor removed from Agent/root HTML.
- Access page unregisters service workers and clears stale model auth storage before use.
- Visible release fingerprint: `MODEL ACCESS 16.12.97 · ROUTE AUTHORITY`.
- `/portal/release.txt` provides a live deployment probe.
