# CAVYRE 16.14.16 — Login + Calendar Stability Lock

- Fixes the 16.14.15 login-shell packaging regression: Fashion Week, Season Command, and Season Guard were referenced as 16.14.15 but absent from the deployable `public/assets` directory.
- Restores those shell dependencies as real 16.14.16 files in every Agent asset mirror.
- Preserves the 16.14.15 Calendar Design Lock runtime rather than replacing Calendar again.
- Removes the malformed nested query-string reference from the legacy pages shell dependency.
- Adds an exact shell-manifest validation gate: every file named by the login shell must physically exist under Netlify publish authority (`public/assets`).
- No Supabase schema/auth changes. No Model Portal or Mother Agency Portal changes.
