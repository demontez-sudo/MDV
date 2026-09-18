# CAVYRE 16.14.15 — Flat Deploy + Calendar Lock

Root cause corrected: 16.14.14 was packaged inside a top-level `cavyre_161414/` folder instead of exposing `netlify.toml`, `public/`, and `admin/` at ZIP root. A drag/drop deploy therefore did not represent the intended Agent release.

16.14.15 preserves the approved 3D Orbit / 3-Day Runway / Week Command / Month Matrix Calendar runtime from 16.14.14, updates release markers, and packages the site at deploy root.
