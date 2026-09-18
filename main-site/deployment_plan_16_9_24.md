# VEUX DESK 16.9.24 — Coordinated Branded Admin + Package Cutover

## Deploy exactly in this order

### 1. Main Maison website
Deploy `MAISON-DE-VEUX-FULL-SITE-16.9.24-BRANDED-ADMIN-PACKAGE-ROUTING-2026-08-18.zip` to the Netlify project that owns `maisondeveux.com`.

Smoke checks before moving on:
- `https://www.maisondeveux.com/admin` should render the Agent Portal through the Maison domain. With the old Agent build still live, visual behavior under `/admin` is not the final test; the important first-deploy checks are that the route is no longer a 302 handoff and that an existing `/p/{token}` package email no longer returns the main-site 404.
- Open one **existing package email** that previously returned Page Not Found. The same token should now reach the Agent package viewer. No resend is required.
- `https://www.maisondeveux.com/team` should remain usable during this transition because it still hands off to the current Agent origin.

### 2. Agent Portal
Deploy `VEUX-DESK-16.9.24-AGENCY-BRANDED-ADMIN-PACKAGE-ROUTING-MOGY-2026-08-18.zip` to `maison-agent`.

Final smoke checks:
- opening `https://maison-agent.netlify.app/` should land on `https://www.maisondeveux.com/admin`
- browser URL should remain `maisondeveux.com/admin` while navigating the Agent Portal
- `https://www.maisondeveux.com/team` should end at `/admin` via the safe legacy chain
- login/logout/password recovery should stay on the branded admin route
- create a fresh package, select models, send it, confirm `SENDING… → SENT ✓`
- new email **View Full Package** should use `maisondeveux.com/p/...` and open
- clickable published model cards should open their `maisondeveux.com/{model}` profile
- unpublished model cards should open their anchored section inside the private package

## Do not deploy for this cutover
- Model Portal
- MA Portal
- individual model profile sites

Those are not required for the branded Agent/package routing fix.
