# CAVYRE 16.12.94 — Model Password Legacy Eradication

This release removes the remaining legacy model-password handoff that could still invoke the shared Supabase browser recovery runtime.

Key changes:
- Every model password/reset alias physically serves the same 16.12.94 Password Center.
- Shared `veux-agent-staging-16.8.5.js` refuses to run legacy password recovery on model routes and hands off to `/portal/password`.
- Temporary-password completion remains server-authoritative through `/api/model/password`.
- Password/reset surfaces are `no-store`.
- Service-worker shell cache is bumped so older auth shells are evicted.
- Publish-root and root copies are synchronized.
