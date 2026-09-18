# CAVYRE 16.12.74 — CRM Instant Write-Through

## Problem
New contacts/companies were saved in the backend, but the Relationships UI could continue
showing its pre-save cached arrays until the entire browser page was refreshed.

## New invariant
WRITE → API VERIFIED RECORD → UPDATE LOCAL DIRECTORY STATE → RENDER → BACKGROUND FRESH GET → RECONCILE

## Changes
- Verified contact/company records are inserted or updated in the active Companies / Contacts state immediately.
- The modal no longer waits for a full CRM reload before closing.
- A fresh CRM request runs in the background after the immediate render.
- Fresh CRM reads use a cache-busting query value and `__fresh:true`.
- Both external and inline authority paths are covered so Netlify asset ordering cannot silently restore stale-refresh behavior.
- No CRM schema migration.
- No Calendar, Package, Season, Model Portal, or authentication logic changed.
