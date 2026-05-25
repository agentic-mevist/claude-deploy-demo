# claude-deploy-demo

A tiny static landing page generated, committed, and deployed end-to-end by
[Claude Code](https://claude.com/code).

- **Source**: this repo
- **Host**: Cloudflare Pages
- **Stack**: plain HTML / CSS / JS (no build step)

## Local preview

```sh
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

This repo is deployed to Cloudflare Pages via the Cloudflare API. Any push
to `main` can be wired to trigger a new deployment.
