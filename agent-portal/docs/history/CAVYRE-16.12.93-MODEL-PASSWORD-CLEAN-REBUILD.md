# CAVYRE 16.12.93 — Model Password Clean Rebuild

- Temporary-password completion no longer stores or requires a refresh token.
- Recovery completion no longer stores or requires a refresh token.
- Both flows verify the new password server-side, clear stale browser auth, then require one clean sign-in with the new password.
- Normal model login is the only place that establishes a new Supabase session.
- All production release markers updated to 16.12.93.
