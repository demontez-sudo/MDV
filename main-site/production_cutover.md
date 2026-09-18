# Maison de Veux Website — Production Roster Hotfix

Production Supabase project: `mogyngdhmzbjmcdqeoxu`.

The six public roster pages now call the read-only `website_public_roster` RPC directly with the production Supabase publishable key. No service-role key or Netlify Function is required for roster rendering.

This is intentional: the RPC returns only active models whose public profile is explicitly published, plus public media and public profile routing fields.

Portal entry routes remain:
- `/admin` and `/team` -> `https://maison-agent.netlify.app/`
- `/portal` -> 200 reverse proxy to `https://maison-models.netlify.app/` (branded URL remains in browser)
- `/ma` -> 200 reverse proxy to `https://maison-ma.netlify.app/` (branded URL remains in browser)

The website's existing editorial/news pages remain on the original `mogy...` project.
