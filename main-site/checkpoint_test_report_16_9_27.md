# Checkpoint Test Report — 16.9.27

Date: 2026-08-18

## Agent Portal 16.9.27

Full `npm run check:rc`: PASS.

Dedicated gates:

- Model Media Upload Integrity: 17/17 PASS.
- Model File + Forms Integrity: 24/24 PASS.
- All inherited release gates through 16.9.25: PASS.
- Calendar, CRM, Mobility/Visa, Model 360, Model Accounts, Packages/Resend, CRUD/API, login/bootstrap, branded `/admin`: PASS.

Key assertions include:

- no undefined `cloudUpload` media path
- all Model 360 upload entry points use signed uploads
- exact Women/Men normalization
- Women and Men board option matrices
- live Gender/Department/Market recalculation
- atomic Model 360 save path
- isolated Agent auth storage
- Files & Forms server boundary
- private Get Scouted media storage
- transactional Get Scouted finalization
- rollback verification migrations

## Model Portal 16.9.4

Full `npm run check:rc`: PASS.

- 35 JS/MJS files certified.
- `/portal` contract PASS.
- Model Account carry-forward PASS.
- Supabase CDN fallback PASS.
- document.write startup removed.
- shell-first bootstrap PASS.
- versioned active assets PASS.
- isolated Model auth storage PASS.
- MOGY hard lock PASS.

## Mother Agency Portal 16.7.8

Full `npm run check:rc`: PASS.

- 22 JS/MJS files certified.
- `/ma` contract PASS.
- Supabase CDN fallback PASS.
- document.write startup removed.
- shell-first bootstrap PASS.
- versioned active assets PASS.
- isolated MA auth storage PASS.
- MOGY hard lock PASS.

## Main Site 16.9.27

- Main site gate: PASS.
- Cross-Portal Branded Routing: 8/8 PASS.
- `/portal` and `/portal/*` are 200 reverse proxies.
- `/ma` and `/ma/*` are 200 reverse proxies.
- old 302 Model/MA handoffs removed.
- Get Scouted form/API routing PASS.
- existing `/admin` and `/p/*` routes preserved.

## Coordinated gate

16 assertions PASS:

- unique Agent / Model / MA auth storage
- all three apps hard-locked to MOGY
- `/admin`, `/portal`, `/ma` branded mounts
- public-site reverse proxies for all three apps
- root `_redirects` protection
- Get Scouted same-origin intake
- old Model/MA 302 handoffs absent

## Production database verification

Adenike Aluko is now the same existing model ID with:

- Women
- Development
- New York primary
- New York Development + Paris Development boards

Current verification snapshot after rollback testing:

- Get Scouted form submissions created by verification: 0
- Get Scouted prospects created by verification: 0
- Get Scouted documents created by verification: 0
- Models with multiple primary media: 0
- `finalize_get_scouted_submission_v1`: service_role EXECUTE = true
- authenticated EXECUTE = false
- anon EXECUTE = false

No synthetic Get Scouted verification data remains in production.
