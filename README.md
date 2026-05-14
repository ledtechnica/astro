# LED Technica

Personal blog. Astro 6 + Tailwind 4 + MDX (Content Layer API), deployed to GitHub Pages on `ledtechnica.com`.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # generates dist/
pnpm preview      # serves dist/ on http://localhost:4321
```

## Import posts from Medium

```bash
pnpm import:medium   # reads medium/medium-export-*/posts/*.html, writes src/content/blog/*.mdx
```

The Medium export ZIP itself is gitignored; once the import is done the MDX in `src/content/blog/` is the source of truth.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml` which builds with Astro and ships to GitHub Pages.

For the custom domain `ledtechnica.com`, set four A records pointing at GitHub Pages IPs (`185.199.108.153`, `.109.153`, `.110.153`, `.111.153`) and verify the domain in the repo's Pages settings. The `public/CNAME` file ships the custom-domain marker with each build.

## Design system

The design package lives in [design-handoff/](design-handoff/). Read [design-handoff/README.md](design-handoff/README.md) and [design-handoff/project/design-system.html](design-handoff/project/design-system.html) before changing visual tokens. The Tailwind config and `src/styles/global.css` are derived from those files.
