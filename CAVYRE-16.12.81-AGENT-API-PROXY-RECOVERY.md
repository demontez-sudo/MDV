# CAVYRE 16.12.81 — Agent API Proxy Recovery

## Repair

The branded Agent Portal at `/admin` was loading its static assets through the Maison de Veux reverse proxy, but authentication bootstrap calls were deliberately excluded from the `/admin` mount. That caused signed-in sessions on the branded domain to request `/api/agent/bootstrap` from the public website instead of through the Agent proxy, producing `VEUX API 404` and preventing the portal shell from opening.

16.12.81 makes the portal mount authoritative for API/config/health requests as well as static assets. On the branded domain, `/api/...` now becomes `/admin/api/...`, allowing the existing `/admin/*` reverse proxy to carry the request to the Agent Netlify origin. Direct visits to the Agent origin continue to use root `/api/...` because the mount is empty there.

No Supabase credentials, organization identifiers, login rules, roster data, calendar behavior, CRM behavior, or model-portal auth flows were changed.
