# CAVYRE 16.11.58 — Single CRM Authority

This build consolidates Company, Contact, and Relationship create/edit operations into one CRM runtime: `assets/cavyre-crm-authority-16.11.58.js`.

- One API authority: `/api/agent/crm/v9`
- One Company form
- One Contact form
- One canonical Contact record with multiple Company/Agency/Client links
- Relationship Desk list/detail views remain in the consolidated portal renderer but delegate all record mutations to the single CRM authority
- Legacy CRM modal/form renderers are retired from the relationship renderer and the 16.9.4 stability compatibility layer
- Old global CRM entry points are compatibility aliases only; they call `CavyreCRM` and do not render separate forms
- Root and `/admin` load the same CRM authority
