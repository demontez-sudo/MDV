# VEUX DESK 16.9.27 — Deployment Plan

Deploy the four independent apps to their existing Netlify projects. Do not create new Netlify sites.

## Recommended order

1. **Agent Portal 16.9.27** → existing `maison-agent` project.
   - Makes the new Get Scouted / Files & Forms server endpoints available before the public form cutover.
   - Adds Model 360 upload + gender/board fixes.

2. **Main Website 16.9.27** → existing main Maison de Veux project that owns `maisondeveux.com`.
   - Changes `/portal` and `/ma` from 302 handoffs to branded 200 reverse proxies.
   - Connects `/get-scouted` to the Agent Forms Inbox endpoint.
   - Preserves `/admin` and private `/p/*` package routes.

3. **Model Portal 16.9.4** → existing `maison-models` project.
   - Bootstrap/session/cache integrity update.

4. **Mother Agency Portal 16.7.8** → existing `maison-ma` project.
   - Bootstrap/session/cache integrity update.

## Smoke test after deployments

Agent:
- Open `https://www.maisondeveux.com/admin`.
- Open Adenike in Model 360; verify Women → Development and NY + Paris placement.
- Upload one test image to a model; verify Media Manager refresh and Model Portal visibility according to public/private settings.
- Confirm Gender changes immediately change available Board choices.
- Open Files & Forms.

Main / forms:
- Open `/get-scouted` and submit only if using a real test applicant/photo set; otherwise verify UI only.

Model:
- Open `https://www.maisondeveux.com/portal`.
- Verify the URL remains branded and does not bounce to/from Netlify.
- Verify secure login/session loads without an indefinite loading screen.

MA:
- Open `https://www.maisondeveux.com/ma`.
- Verify the URL remains branded and does not bounce to/from Netlify.
- Verify secure partner login/session loads without an indefinite loading screen.

## Do not deploy

- No new individual model-profile site deployment is required solely for this checkpoint.
- Do not re-run the database migrations manually; they are already present in MOGY.
