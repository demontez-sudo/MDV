# CAVYRE 16.12.90 — Temporary Password Route Isolation

Temporary-password authentication is now isolated from recovery-token authentication.

- Generated temporary passwords point to `/portal/auth?flow=temp`.
- `/portal?flow=temp` redirects before the model portal runtime loads.
- Temp login clears stale Supabase browser tokens before credential verification.
- Successful temp login opens `/portal/password?...&flow=temp`.
- The permanent-password page requires email + current temporary password + new password and uses the server-side direct-change endpoint.
- Legacy reset routes without an actual recovery token redirect to the temp/current password page instead of attempting Supabase refresh-token recovery.
- Recovery-token routes remain separate for genuine Forgot Password emails.
