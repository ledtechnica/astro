// Tag → LED color map, derived from design-handoff/project/design-system.html "Astro notes" section.
// Anything unmapped falls back to "cyan" (the eyebrow / general-tech color in the system).

export type LedColor = "pink" | "yellow" | "cyan";

const TAG_COLOR: Record<string, LedColor> = {
  infra: "pink",
  security: "pink",
  opinion: "pink",
  meta: "pink",
  languages: "pink",
  aws: "pink",
  product: "pink",
  apple: "pink",
  saas: "pink",
  startup: "pink",
  privacy: "pink",
  design: "pink",
  ux: "pink",
  ssl: "pink",
  git: "pink",
  postgres: "yellow",
  performance: "yellow",
  tools: "yellow",
  debugging: "yellow",
  edge: "yellow",
  reliability: "yellow",
  postmortem: "yellow",
  testing: "yellow",
  wordpress: "yellow",
  analytics: "yellow",
  web: "yellow",
  cdn: "yellow",
  cloud: "cyan",
  api: "cyan",
  databases: "cyan",
  rails: "cyan",
  heroku: "cyan",
  ruby: "cyan",
  ghost: "cyan",
};

export function colorForTag(tag: string): LedColor {
  return TAG_COLOR[tag.toLowerCase()] ?? "cyan";
}

export const HEX_FOR_COLOR: Record<LedColor, string> = {
  pink: "#ec4673",
  yellow: "#f5c542",
  cyan: "#2dd4d4",
};
