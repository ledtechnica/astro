#!/usr/bin/env node
// Medium → MDX import. Reads every HTML file in `medium/medium-export-*/posts/`
// and produces a matching `src/content/blog/<slug>.mdx` with frontmatter +
// body. Images referenced from Medium's CDN are downloaded into
// `public/posts/<slug>/` (served verbatim by Astro) and the body is rewritten
// to reference `/posts/<slug>/<filename>`. Idempotent.
//
// Run: pnpm import:medium

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const MEDIUM_ROOT = join(ROOT, "medium");
const OUT_ROOT = join(ROOT, "src/content/blog");
const IMG_ROOT = join(ROOT, "public/posts");

async function locateExport() {
  const entries = await readdir(MEDIUM_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith("medium-export-")) {
      return join(MEDIUM_ROOT, entry.name);
    }
  }
  throw new Error(`No medium-export-* folder found under ${MEDIUM_ROOT}`);
}

function parseFilename(name) {
  const m = name.match(/^(\d{4}-\d{2}-\d{2})_(.*)-([0-9a-f]{8,13})\.html$/i);
  if (!m) return null;
  const [, date, rawTitle, mediumId] = m;
  const slug = rawTitle
    .replace(/[-_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return { date, slug, mediumId };
}

function imageFilename(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() ?? "img";
    if (/\.[a-z0-9]{2,5}$/i.test(last)) return last;
    const ext = extname(last) || ".jpg";
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
    return `${hash}${ext}`;
  } catch {
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
    return `${hash}.jpg`;
  }
}

async function downloadImage(url, outDir) {
  const filename = imageFilename(url);
  const outPath = join(outDir, filename);
  if (existsSync(outPath)) return filename;
  await mkdir(outDir, { recursive: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (!res.body) throw new Error(`No body for ${url}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath));
    return filename;
  } finally {
    clearTimeout(timeout);
  }
}

let pendingImages = new Map();

function buildTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    fence: "```",
  });
  td.use(gfm);

  td.addRule("dropTitle", {
    filter: (node) =>
      node.nodeName === "H3" &&
      typeof node.getAttribute === "function" &&
      (node.getAttribute("class") || "").includes("graf--title"),
    replacement: () => "",
  });

  td.addRule("figureImage", {
    filter: (node) => {
      if (node.nodeName !== "FIGURE") return false;
      const img = node.querySelector && node.querySelector("img");
      return !!img;
    },
    replacement: (_content, node) => {
      const img = node.querySelector("img");
      const captionEl = node.querySelector("figcaption");
      const src = img.getAttribute("src") || "";
      const alt = (img.getAttribute("alt") || "").replace(/"/g, "&quot;");
      const caption = (captionEl ? captionEl.textContent : "").trim().replace(/"/g, "&quot;");
      const filename = imageFilename(src);
      pendingImages.set(src, filename);
      const captionAttr = caption ? ` caption="${caption}"` : "";
      const altAttr = alt ? ` alt="${alt}"` : "";
      return `\n\n<Figure src="/posts/SLUG_PLACEHOLDER/${filename}"${altAttr}${captionAttr} />\n\n`;
    },
  });

  td.addRule("figureYouTube", {
    filter: (node) => {
      if (node.nodeName !== "FIGURE") return false;
      const iframe = node.querySelector && node.querySelector("iframe");
      if (!iframe) return false;
      return /(youtube|youtu\.be)/.test(iframe.getAttribute("src") || "");
    },
    replacement: (_content, node) => {
      const iframe = node.querySelector("iframe");
      const src = iframe.getAttribute("src") || "";
      const idMatch = src.match(/(?:embed\/|v=)([A-Za-z0-9_-]{6,})/);
      const id = idMatch ? idMatch[1] : "";
      if (!id) return "";
      return `\n\n<YouTube id="${id}" />\n\n`;
    },
  });

  td.addRule("pullquote", {
    filter: (node) =>
      node.nodeName === "BLOCKQUOTE" &&
      (node.getAttribute("class") || "").includes("graf--pullquote"),
    replacement: (content) => `\n\n<Pullquote>${content.trim()}</Pullquote>\n\n`,
  });

  td.addRule("dropEmptyDivs", {
    filter: (node) => ["DIV", "SECTION"].includes(node.nodeName),
    replacement: (content) => content,
  });

  return td;
}

// Escape stray `<` that MDX would otherwise try to parse as JSX.
//
// MDX is more permissive than HTML — it expects every `<X...` to either be a
// known JSX component (PascalCase identifier) or an autolink (`<scheme://...>`).
// Medium's prose freely uses inline HTML-ish tags like `</body>`, mathematical
// operators like `<<`, and other patterns that all look broken to MDX.
//
// Strategy: allow exactly three patterns through unchanged:
//   1. `<Figure ...>`, `<YouTube ...>`, `<Pullquote>...</Pullquote>` (our components)
//   2. `<scheme://...>` autolinks
//   3. Anything inside fenced code blocks or inline backticks
// Everything else: prefix `<` with `\` so MDX renders it as a literal.
const ALLOWED_COMPONENTS = ["Figure", "YouTube", "Pullquote"];
const COMPONENT_RE = new RegExp(
  `^/?(?:${ALLOWED_COMPONENTS.join("|")})(?:\\s|>|$)`,
);
const AUTOLINK_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

function escapeMdxAngleBrackets(md) {
  const lines = md.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      let out = "";
      let i = 0;
      while (i < line.length) {
        const ch = line[i];

        // Inline backtick run: copy through verbatim.
        if (ch === "`") {
          const end = line.indexOf("`", i + 1);
          if (end === -1) {
            out += line.slice(i);
            break;
          }
          out += line.slice(i, end + 1);
          i = end + 1;
          continue;
        }

        if (ch === "<") {
          const rest = line.slice(i + 1);
          if (COMPONENT_RE.test(rest) || AUTOLINK_RE.test(rest)) {
            out += "<";
          } else {
            out += "\\<";
          }
          i++;
          continue;
        }

        out += ch;
        i++;
      }
      return out;
    })
    .join("\n");
}

async function convertPost(htmlPath) {
  const filename = basename(htmlPath);
  const parsed = parseFilename(filename);
  if (!parsed) {
    console.warn(`[skip] cannot parse filename: ${filename}`);
    return;
  }
  const { date, slug, mediumId } = parsed;
  const outDir = join(OUT_ROOT, slug);
  const outFile = join(OUT_ROOT, `${slug}.mdx`);

  if (existsSync(outFile)) {
    const existing = await readFile(outFile, "utf8");
    if (/^imported:\s+hand-edited/m.test(existing)) {
      console.log(`[keep] ${slug} (hand-edited)`);
      return;
    }
  }

  const html = await readFile(htmlPath, "utf8");
  const $ = cheerio.load(html);

  const title = ($("h1.p-name").first().text() || "").trim();
  const subtitle = ($("section[data-field=subtitle]").first().text() || "").trim();
  const description = ($("section[data-field=description]").first().text() || subtitle).trim();
  const pubDateAttr = $("time.dt-published").first().attr("datetime") || `${date}T00:00:00.000Z`;
  const canonicalHref = $("a.p-canonical").first().attr("href") || "";

  const bodyEl = $("section[data-field=body]").first();
  if (!bodyEl.length) {
    console.warn(`[skip] no body section: ${filename}`);
    return;
  }
  const bodyHtml = bodyEl.html() ?? "";

  pendingImages = new Map();
  const td = buildTurndown();
  let markdown = td.turndown(bodyHtml).trim();
  markdown = markdown.replaceAll("SLUG_PLACEHOLDER", slug);
  markdown = escapeMdxAngleBrackets(markdown);

  if (pendingImages.size) {
    const imageDir = join(IMG_ROOT, slug);
    let dots = 0;
    for (const [url] of pendingImages) {
      try {
        await downloadImage(url, imageDir);
        process.stdout.write(".");
        dots++;
      } catch (err) {
        console.warn(`\n[image fail] ${slug} ← ${url}: ${err.message}`);
      }
    }
    if (dots) process.stdout.write("\n");
  }

  const escape = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const fmLines = [`title: "${escape(title)}"`];
  if (description) fmLines.push(`description: "${escape(description)}"`);
  fmLines.push(`pubDate: "${pubDateAttr}"`);
  fmLines.push(`tags: []`);
  fmLines.push(`mediumId: "${mediumId}"`);
  if (canonicalHref) fmLines.push(`mediumUrl: "${canonicalHref}"`);
  fmLines.push(`republishedFrom: "medium"`);

  const usedComponents = [];
  if (/<Figure /.test(markdown)) usedComponents.push("Figure");
  if (/<YouTube /.test(markdown)) usedComponents.push("YouTube");
  if (/<Pullquote>/.test(markdown)) usedComponents.push("Pullquote");

  const componentImports = usedComponents.length
    ? "\n" + usedComponents.map((c) => `import ${c} from "~/components/${c}.astro";`).join("\n") + "\n"
    : "";

  const mdx = `---\n${fmLines.join("\n")}\n---\n${componentImports}\n${markdown}\n`;

  await mkdir(OUT_ROOT, { recursive: true });
  await writeFile(outFile, mdx, "utf8");
  console.log(`[wrote] ${slug}.mdx`);
}

async function main() {
  const exportDir = await locateExport();
  const postsDir = join(exportDir, "posts");
  const stats = await stat(postsDir).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`No posts/ inside ${exportDir}`);
  }
  const files = (await readdir(postsDir))
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(postsDir, f));

  console.log(`Found ${files.length} posts in ${postsDir}`);
  for (const f of files) {
    try {
      await convertPost(f);
    } catch (err) {
      console.error(`[error] ${basename(f)}: ${err.message}`);
    }
  }
  console.log(`\nDone. Output: ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
