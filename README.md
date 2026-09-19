# Mirage, Stadel. × Kendu Entertainment — Run Club Proposal

Static one-page proposal site, hosted on GitHub Pages.

**Live link:** https://exploring-to-see.github.io/Mirage-x-Kendu-Run-Club/

## How it is published

GitHub Pages serves this branch (`claude/github-artifact-hosting-cpra7d`) from
its root — Settings → Pages → Source: *Deploy from a branch*. Every push to the
branch rebuilds the site automatically; no custom domain is set, so the project
URL above is the live one.

`.github/workflows/pages.yml` is an alternative deploy path for the *GitHub
Actions* Pages source. It checks how Pages is configured and skips its deploy
steps while Pages serves a branch directly, so it stays green as-is.

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
