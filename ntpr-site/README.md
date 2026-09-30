# NTPR site

Static rebuild of the NTPR International site originally built in Wix Studio
(`maisondeveux.wixstudio.com/my-site-4`). No build step: publish this folder as-is.

Positioning: **Fashion. Art. Marketing. Experiences.** — *Where creativity meets strategy.*

| Page | File |
|---|---|
| Home | `index.html` |
| Work (filter by pillar, lightbox) | `work/index.html` |
| Fashion / Art / Marketing / Experiences | `fashion/`, `art/`, `marketing/`, `experiences/` |
| About (story, approach, client wall) | `about/index.html` |
| Contact (pillar interest chips; `?interest=art` pre-selects) | `contact/index.html` |
| Insights + Copenhagen post (footer and menu links) | `insights/` |
| Old `/service/` URL | `service/index.html` redirects to the home page's pillars |

- `assets/styles.css`, `assets/main.js`: shared styles, menu drawer, scroll reveals, client marquee, forms
- `assets/img/`, `assets/video/`: media from the Wix site and its media-library export. `assets/video/dioxyd-campaign.mp4`
  is a 720p, 2.2 Mbps, muted web copy of `dioxyd_campaign (1080p).mp4`.
- Header, menu and footer are repeated in every page; change them all together.
- `<main>` is a rounded card that sits on the dark footer (see "Page card + footer" in styles.css).
- Client logos get `style="--lw: N"` (a width chosen from each logo's aspect ratio) so wide wordmarks
  and stacked marks look the same size. Add new logos to `assets/img/clients/` trimmed to their edges.

All paths are relative, so pages also work when opened straight from disk.
Preview locally: `python3 -m http.server 4173 --directory ntpr-site` from the repo root.

The newsletter and contact forms are Netlify Forms (`data-netlify="true"`); submissions only work once
the folder is deployed on Netlify. Insights cards for news reposts link to the original articles;
only the Copenhagen post is NTPR's own and has a page here.
