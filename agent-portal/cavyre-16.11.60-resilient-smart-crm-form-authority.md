# CAVYRE 16.11.60 — Resilient Smart CRM Form Authority

Fixes the runtime failure where + Contact / + Company reached CavyreCRM but failed before drawing the form.

Changes:
- Smart CRM forms render immediately instead of waiting for a fresh CRM GET.
- CRM directory data hydrates asynchronously after the modal is visible.
- Failed CRM reads no longer block creation forms.
- Edit forms rehydrate with the canonical record when data arrives.
- Direct Industry Relations buttons use window.CavyreCRM safely.
- Existing single CRM API `/api/agent/crm/v9` remains authoritative.
- No legacy form renderer is restored.
