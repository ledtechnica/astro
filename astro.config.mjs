import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://ledtechnica.com",
  trailingSlash: "ignore",
  // Dev-server port from the workspace registry (infra-aws
  // terraform/cloudflare-tunnels/PORTS.md) — astro's 4321 default collides
  // with tinbee marketing.
  server: { port: 4324 },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [mdx(), sitemap()],
  build: {
    format: "directory",
  },
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: true,
    },
  },
});
