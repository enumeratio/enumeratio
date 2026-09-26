# web

The [enumeratio.dev](https://enumeratio.dev) site, built with [VitePress](https://vitepress.dev/):
guides, the generated reference pages, the worksheet and notebook, explorations, and the
benchmark and review pages.

```sh
vp run dev   # from the repo root; serves this site
```

Merges to `main` deploy to GitHub Pages (`.github/workflows/pages.yml`; `public/CNAME` names the
domain), and every build also gets a Cloudflare Pages preview — see AGENTS.md, "CI and deployment".
