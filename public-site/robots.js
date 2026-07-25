import { SITE_ORIGIN } from "./layout.js";
import { disallowedPaths, glossarySlugs } from "./pages/content.js";
import { questionSlugs } from "./pages/questions.js";
import { findingSlugs } from "./pages/findings.js";

// AI crawlers are explicitly welcome: this site exists to observe them, so
// blocking them would defeat the entire measurement. The Disallow rules below
// are the instrument — the three paths serve ordinary 200 responses, and a
// fetch of one is a measured act rather than a trap.

const WELCOMED_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "Bytespider",
  "cohere-ai",
  "Diffbot",
  "Timpibot",
  "YouBot"
];

export function robotsTxt() {
  const welcomed = WELCOMED_AGENTS.map((ua) => `User-agent: ${ua}`).join("\n");
  const disallows = disallowedPaths()
    .map((p) => `Disallow: ${p.replace(/\/[^/]*$/, "/")}`)
    .join("\n");

  return `# AI crawlers and agents are welcome here.
# This site measures how AI systems read the web; blocking them would defeat it.
# Nothing is cloaked: every client receives identical bytes for the same URL.

${welcomed}
Allow: /

User-agent: *
Allow: /
${disallows}

# The disallowed paths above serve ordinary content and return 200. They are not
# traps and contain nothing sensitive. They exist so that robots.txt compliance
# is measurable rather than assumed. Results: ${SITE_ORIGIN}/lab

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

export function publicUrls() {
  return publicPages().map(([path]) => path);
}

function publicPages() {
  return [
  ["/", "1.0"],
  ["/observatory", "0.9"],
  ["/lab", "0.9"],
  ["/findings", "0.9"],
  ...findingSlugs().map((slug) => [`/findings/${slug}`, "0.8"]),
  ["/questions", "0.9"],
  ...questionSlugs().map((slug) => [`/questions/${slug}`, "0.8"]),
  ["/how-it-works", "0.8"],
  ["/what-we-measure", "0.8"],
  ["/constitution", "0.7"],
  ["/about", "0.6"],
  ["/lab/methodology", "0.7"],
  ...glossarySlugs().map((slug) => [`/glossary/${slug}`, "0.6"]),
  ["/probe/html", "0.5"],
  ["/probe/js", "0.5"],
  ["/probe/noscript", "0.5"],
  ["/probe/data.json", "0.5"],
  ["/probe/data.md", "0.5"],
  ["/probe/data.txt", "0.5"],
  ["/feed.xml", "0.4"]
  ];
}

export function sitemapXml(lastmod) {
  const day = (lastmod ?? new Date().toISOString()).slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicPages().map(
  ([path, priority]) => `<url>
<loc>${SITE_ORIGIN}${path}</loc>
<lastmod>${day}</lastmod>
<priority>${priority}</priority>
</url>`
).join("\n")}
</urlset>
`;
}
