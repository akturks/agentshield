import { SITE_ORIGIN } from "./layout.js";
import { disallowedPaths, glossarySlugs } from "./pages/content.js";
import { questionSlugs } from "./pages/questions.js";
import { findingSlugs } from "./pages/findings.js";
import { weeksObserved } from "./weekly.js";

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

// A declared rate, published so that honouring it becomes an observable act.
//
// The same trick as the disallowed paths: compliance cannot be measured against a
// rule nobody was given. Until this line existed the record could show how fast a
// client went and never whether it went faster than asked, because nothing had
// been asked.
//
// Ten seconds is deliberately loose. This is an instrument, not a defence — a
// value tight enough to inconvenience a well-behaved crawler would change the
// behaviour being measured, which Article V rules out. Crawl-delay is also not
// part of the original robots.txt specification and several major crawlers
// document that they ignore it; that is itself the measurement, and a client
// ignoring a directive it never promised to honour is reported as exactly that
// and not as a violation.
const CRAWL_DELAY_SECONDS = 10;

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
Crawl-delay: ${CRAWL_DELAY_SECONDS}

User-agent: *
Allow: /
Crawl-delay: ${CRAWL_DELAY_SECONDS}
${disallows}

# The disallowed paths above serve ordinary content and return 200. They are not
# traps and contain nothing sensitive. They exist so that robots.txt compliance
# is measurable rather than assumed. Results: ${SITE_ORIGIN}/lab
#
# Crawl-delay is published for the same reason: a rate nobody was given cannot be
# honoured or ignored, only guessed at. It is set loose on purpose, it is not
# enforced, and no request is ever refused for exceeding it. Crawl-delay is not
# part of the original specification and several crawlers state that they ignore
# it — that is a measurement, not a grievance.

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
}

export function publicUrls() {
  return publicPages().map(([path]) => path);
}

function publicPages() {
  return [
  ["/weekly", "0.9"],
  ...weeksObserved().map((w) => [`/weekly/${w}`, "0.7"]),
  ["/", "1.0"],
  ["/observatory", "0.9"],
  ["/verify", "0.9"],
  ["/survey", "0.9"],
  ["/discovery", "1.0"],
  ["/lab", "0.9"],
  ["/findings", "0.9"],
  ...findingSlugs().map((slug) => [`/findings/${slug}`, "0.8"]),
  ["/audit", "0.9"],
  ["/cdn-interventions", "0.9"],
  ["/questions", "0.9"],
  ...questionSlugs().map((slug) => [`/questions/${slug}`, "0.8"]),
  ["/how-it-works", "0.8"],
  ["/what-we-measure", "0.8"],
  ["/constitution", "0.7"],
  ["/about", "0.6"],
  ["/privacy", "0.4"],
  ["/lab/methodology", "0.7"],
  ["/status", "0.7"],
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
