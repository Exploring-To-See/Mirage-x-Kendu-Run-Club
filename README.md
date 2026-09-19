# Mirage, Stadel. × Kendu Entertainment — Run Club Proposal

Static one-page proposal site, hosted on GitHub Pages.

**Live link (once Pages is on):** https://exploring-to-see.github.io/Mirage-x-Kendu-Run-Club/

## Turning Pages on (one time, repo admin)

GitHub only lets an account with admin rights create a Pages site — neither the
Actions token nor an app token can do it — so the first switch is manual:

**Settings → Pages → Build and deployment → Source**

* **Deploy from a branch** → branch `claude/github-artifact-hosting-cpra7d`,
  folder `/ (root)` → Save. The site builds straight from this branch; nothing
  else is needed.
* **GitHub Actions** → then run the *Deploy site to GitHub Pages* workflow on
  this branch. It stages `index.html`, `run-video.mp4` and `.nojekyll` into
  `_site/` and deploys them.

The workflow checks how Pages is configured and skips its deploy steps (with a
note in the run summary) when Pages is off or is serving a branch directly, so
it stays green either way.

## Contents

| File | Purpose |
| --- | --- |
| `index.html` | The full self-contained proposal page (styles, scripts and images inline). |
| `run-video.mp4` | Video asset referenced by the page. |
| `vercel.json` | Cache headers, kept for an optional Vercel deploy. |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is, without Jekyll processing. |

All asset paths in `index.html` are relative, so the page works from a
subdirectory such as `/Mirage-x-Kendu-Run-Club/`.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
