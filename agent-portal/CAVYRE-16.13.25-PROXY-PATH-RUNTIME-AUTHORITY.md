# CAVYRE 16.13.25 — Proxy Path Runtime Authority

Verified failure in 16.13.24: the public root HTML was the effective reverse-proxy document, but 16.13.24 runtime assets existed only under public/admin/assets. The root shell therefore requested four missing /assets/cavyre-* files, recorded them in __VEUX_SHELL_FAILURES__, and the authenticated login intentionally refused to open the Agency interface.

16.13.25 mirrors the single Calendar/Season/Fashion Week authority into both public/assets and public/admin/assets, updates all Agent HTML entry points, restores the M styling on the root proxy document, and aligns the visible release marker. No auth policy, Supabase schema, Model Portal, or MA Portal changes.
