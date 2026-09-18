# MDV

One repository for everything served under **www.maisondeveux.com**. Edit here, commit, push. Do not
keep working from downloaded zip exports.

| Folder | Live at | Netlify project | Base directory |
|---|---|---|---|
| `main-site/` | `maisondeveux.com` | maisondeveux.com | `main-site` |
| `agent-portal/` | `maisondeveux.com/admin` | maison-agent | `agent-portal` |
| `mother-agency-portal/` | `maisondeveux.com/ma` | maison-ma | `mother-agency-portal` |
| `model-portal/` | `maisondeveux.com/portal` | (model portal site) | `model-portal` |

The main site reverse-proxies `/admin`, `/portal` and `/ma` to the other three Netlify projects
(see `main-site/netlify.toml` and `main-site/_redirects`). Each project keeps its own environment
variables in Netlify; nothing secret lives in this repo.

## Rules that stop the old mess coming back

- **One file per feature.** Replace a file's contents; do not add `-16.x.y` copies next to it.
  Each "fix as a new version" copy is how hundreds of dead files and silent load-order bugs accumulated.
- **Edit only what is deployed.** `agent-portal` publishes `public/` only. `public/assets` and
  `public/admin/assets` are near-mirrors: change both together.
- **Check before pushing.**
  - `cd agent-portal && npm run check` verifies every referenced asset exists and every script parses.
  - `cd main-site && npm run check` runs the routing, mobile and interaction gates.
- Release notes live in `agent-portal/docs/history`.

## Known gaps

- `model-portal` and `mother-agency-portal` came from Netlify deploy exports, which do not include
  Netlify Function source. Their backends (e.g. `model-legacy-gateway`) are not in this repo.
- `main-site/netlify.toml` and `mother-agency-portal/netlify.toml` declare `publish = "public"` but
  have no `public/` folder; the real setting is presumably in the Netlify dashboard.
