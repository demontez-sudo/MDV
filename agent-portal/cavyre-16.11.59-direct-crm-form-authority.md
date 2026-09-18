# CAVYRE 16.11.59 — Direct CRM Form Authority

Source: user-uploaded deployed 16.11.58 package.

Root cause confirmed:
- The visible Industry Relations page is rendered by `veux-agent-v16.8.6-product.js`.
- Its + Company and + Contact buttons directly called `VEUX_V133.newCompany/newContact`.
- `VEUX_V133` is created asynchronously by `veux-agent-v15-extensions-16.8.5.js`, after the top-level CRM authority can initialize.
- That legacy object contains the exact basic forms shown in the screenshots.

Repair:
- Industry Relations buttons now call `CavyreCRM.openCompany/openContact` directly.
- Older core Industry Relations buttons now call the same authority directly.
- `VEUX_V133.newCompany/newContact` no longer render legacy forms; they delegate to CavyreCRM.
- Capture-phase CRM routing is installed as a final safety authority.
- Smart CRM remains backed by `/api/agent/crm/v9`.
- Smart form fields include relationship intelligence, priority, follow-up cadence, owner, markets, WhatsApp, LinkedIn, tags, multiple company relationships, notes and Vera research.

No second CRM database/API was introduced.
