# CAVYRE 16.14.06 — Login Shell Asset Recovery

Root cause confirmed: 16.14.05 updated the Agent shell to request four 16.14.05 Season/Calendar runtime files that were not physically packaged in the Agent asset directories. Authentication could succeed, but `waitForShellReady()` rejected the session because `__VEUX_SHELL_FAILURES__` contained those missing assets, producing: “The secure login is connected, but the Agency interface did not finish loading.”

16.14.06 restores the missing release assets in every Agent serving mirror and updates the three Agent entry points to one release generation. No authentication logic, Supabase credentials, Model Portal auth, or MA Portal auth was changed.

Validation: all 63 `asset()` references across the three Agent entry points resolve; all 20 login-shell assets resolve; critical JavaScript passes `node --check`.
