export const SITE_ORIGIN = "https://agentshieldaidefense.com";
import { verificationTags } from "./verification.js";
export const SITE_NAME = "AgentShield AI Defense";

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A recorded moment, to the second, in UTC.
 *
 * Everything published here used to be cut to ten characters — the date alone.
 * That was wrong in two places and one of them was the measurement itself: a
 * marker's publication instant is the zero point from which time-to-ingestion is
 * counted, and printing "2026-07-26" gave that clock a 24-hour error before the
 * measurement had begun. The other is any event shorter than a day; a scan that
 * lasted six seconds is not described by its date.
 *
 * UTC is stated rather than converted. A reader comparing this against their own
 * logs needs to know which clock produced it, and a local rendering of a
 * server-side record invites two readers to disagree about when something
 * happened.
 */
export function instant(value) {
  if (!value) return "";
  const text = String(value);
  return `${text.slice(0, 10)} ${text.slice(11, 19)} UTC`.trim();
}

/**
 * A string recorded from a client, printed exactly as it arrived.
 *
 * The wrapper is Cloudflare's documented opt-out from email-address obfuscation.
 * Without it, the CDN rewrites anything shaped like an address *in transit*: the
 * user agent `Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)`
 * reached readers as `ClaudeBot/1.0; [email protected]`, with a decoder script
 * injected. The page that says user agents are "recorded verbatim and counted
 * as-is" was serving an altered observation, and the constitution's promise of
 * identical bytes to every client was false on it.
 *
 * Invisible from inside the application, which is the whole difficulty: this
 * server sent the right bytes. Article V is about what a reader receives, and
 * that is not the same object as what the origin emits.
 *
 * This is not cloaking. It removes a third party's alteration; every client still
 * receives the same bytes, and the bytes are now the ones that were observed.
 */
export function recorded(value) {
  return `<!--email_off-->${escapeHtml(value)}<!--/email_off-->`;
}

// The console's visual language — technical palette, bordered panels, monospace
// for anything measured — applied to a page that still has to carry long prose.
// Figures look like readings; paragraphs stay comfortable to read. Both themes
// are supported because forcing dark on a public page is a preference, not a
// design decision.
const STYLE = `
:root{color-scheme:light dark;
--bg:#fcfcfd;--panel:#f6f7f9;--fg:#14161a;--muted:#5c636e;--line:#e3e6ea;
--accent:#2563a8;--accent-dim:#5b8dd6;--code:#f0f2f5;--ok:#2f7d4f}
@media(prefers-color-scheme:dark){:root{
--bg:#0e0f11;--panel:#16181c;--fg:#dfe3e8;--muted:#858d98;--line:#262a30;
--accent:#6fa2e0;--accent-dim:#5b8dd6;--code:#1a1d22;--ok:#4ea36a}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);-webkit-text-size-adjust:100%;
font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,system-ui,sans-serif;
font-feature-settings:"kern","liga";letter-spacing:-0.003em}
.wrap{max-width:46rem;margin:0 auto;padding:2.25rem 1.25rem 4rem}
header{border-bottom:1px solid var(--line);padding-bottom:.9rem;margin-bottom:2.5rem}
.brand{font-weight:650;font-size:.95rem;letter-spacing:.02em;text-decoration:none;color:var(--fg)}
nav{margin-top:.7rem;font-size:.85rem;display:flex;flex-wrap:wrap;gap:0 1.15rem}
nav a{color:var(--muted);text-decoration:none;white-space:nowrap;padding-bottom:2px}
nav a:hover{color:var(--fg)}
nav a[aria-current]{color:var(--fg);border-bottom:1.5px solid var(--accent)}
h1{font-size:1.75rem;line-height:1.25;margin:0 0 1rem;font-weight:680;letter-spacing:-0.02em}
h2{font-size:1.15rem;margin:2.75rem 0 .7rem;font-weight:650;letter-spacing:-0.012em}
h3{font-size:1rem;margin:1.9rem 0 .45rem;font-weight:640}
p,li{color:var(--fg)}
li{margin:.3rem 0}
.lede{font-size:1.08rem;line-height:1.6;color:var(--muted)}
a{color:var(--accent);text-underline-offset:2px}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em;
background:var(--code);padding:.1em .38em;border-radius:3px;word-break:break-all;
letter-spacing:0;border:1px solid var(--line)}
pre{background:var(--code);border:1px solid var(--line);padding:.9rem 1rem;border-radius:6px;
overflow-x:auto;font-size:.84rem;line-height:1.55}
pre code{background:none;padding:0;border:none}
table{border-collapse:collapse;width:100%;font-size:.85rem;margin:1.1rem 0;
background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden;
font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0}
th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:none}
th{font-weight:600;color:var(--muted);font-size:.72rem;text-transform:uppercase;
letter-spacing:.07em;font-family:inherit;white-space:nowrap}
.scroll{overflow-x:auto;max-width:100%}
blockquote{margin:1.6rem 0;padding:.85rem 1.1rem;border-left:2px solid var(--accent);
background:var(--panel);border-radius:0 5px 5px 0;color:var(--fg);font-size:1.02rem}
blockquote p{margin:.2rem 0}
.marker{margin-top:3.5rem;padding:.9rem 1rem;border:1px solid var(--line);border-radius:6px;
background:var(--panel);font-size:.8rem;color:var(--muted);line-height:1.6}
.marker p{margin:.25rem 0;color:var(--muted)}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);
font-size:.8rem;color:var(--muted)}
footer a{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(8.5rem,1fr));gap:.7rem;margin:1.6rem 0}
.grid>div{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:.8rem .9rem}
.stat{font-size:1.75rem;font-weight:680;line-height:1.15;letter-spacing:-0.02em;
font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.stat-label{font-size:.68rem;color:var(--muted);text-transform:uppercase;
letter-spacing:.08em;margin-top:.25rem;font-weight:600}
img{max-width:100%}
figure.diagram{margin:2.25rem 0;padding:0}
svg.dg{max-width:100%;height:auto;display:block;color:var(--fg)}
figcaption{font-size:.84rem;color:var(--muted);margin-top:.85rem;line-height:1.6}
.qa{margin:1.6rem 0;padding:1rem 1.1rem;border:1px solid var(--line);border-radius:6px;background:var(--panel)}
.qa h3{margin-top:.2rem}
.qa p{margin:.4rem 0}
.status{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);
font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
hr{border:none;border-top:1px solid var(--line);margin:2.5rem 0}
button{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;
letter-spacing:0;padding:.5rem .9rem;margin:.2rem .3rem .2rem 0;border:1px solid var(--line);
background:var(--panel);color:var(--fg);border-radius:5px;cursor:pointer}
button:hover{border-color:var(--accent);color:var(--accent)}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
`;

// Subject first, then the week, then the rest.
//
// `/observatory` was cut from this list once, on the reasoning that it was the
// home page at greater length and reading the same argument twice is worse than
// reading it once. That was right about the duplication and wrong about what it
// cost. It was the only page that says what this watches — the four populations
// that arrive at any public site and behave differently enough that counting them
// together destroys the signal. Without it the site published figures and rules
// and never named its subject, and a reader who cannot tell what is being watched
// has no reason to care how carefully it is being watched.
//
// It leads for that reason. The home page now carries the short version and links
// here for the rest, which is a summary and its detail rather than one argument
// told twice.
//
// `/verify` follows the pages that state the subject and the week, because it is
// the only page here a reader would send to somebody else, and an observatory
// with no readers measures the web perfectly and tells nobody.
//
// `/audit` moved to the footer to make room. It is a second stream — whether a
// codebase still does what its documentation says — and that page has always said
// its audience is a different one. `/status` sits there for a related reason: it
// reports the instrument's health rather than anything the instrument saw.
//
// Neither page is deleted, and this is not tidiness. Both carry a published
// marker, and a marker on a page that 404s can never be ingested again — retiring
// a surface silently removes a measurement that was already running.
const NAV = [
  ["/observatory", "Observatory"],
  ["/discovery", "Discovery"],
  ["/weekly", "Weekly"],
  ["/verify", "Verify"],
  ["/lab", "Lab"],
  ["/findings", "Findings"],
  ["/questions", "Questions"],
  ["/constitution", "Constitution"]
];

/**
 * Renders a full page. The canary token is rendered visibly in the footer and
 * mirrored into JSON-LD; hiding it would be cloaking, and the goal is ingestion
 * rather than stealth.
 */
export function page({
  title,
  description,
  path,
  canary,
  body,
  published,
  noindexNote = false,
  schemaType = "WebPage",
  mainEntity = null
}) {
  const url = `${SITE_ORIGIN}${path}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: title,
    description,
    url,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_ORIGIN },
    ...(mainEntity ? { mainEntity } : {}),
    ...(canary ? { identifier: canary } : {}),
    ...(published ? { datePublished: published } : {})
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — ${escapeHtml(SITE_NAME)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:type" content="website">
${verificationTags(escapeHtml)}
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header>
<a class="brand" href="/">${escapeHtml(SITE_NAME)}</a>
<nav>${NAV.map(
    ([href, label]) =>
      `<a href="${href}"${href === path ? ' aria-current="page"' : ""}>${escapeHtml(label)}</a>`
  ).join("")}</nav>
</header>
<main>
${body}
</main>
${
  canary
    ? `<div class="marker"><p>Reality marker for this page: <code>${escapeHtml(canary)}</code>${
        published
          ? ` &middot; published ${escapeHtml(instant(published))}`
          : ""
      }</p>
<p>This string is coined and appears nowhere else. If it later surfaces in a language model's output, that is observed evidence this page was ingested. <a href="/glossary/canary-token">What this is</a>.</p></div>`
    : ""
}
<footer>
<p>${escapeHtml(SITE_NAME)} — an open observatory of how AI systems read the web.
${noindexNote ? "This page is listed under <code>Disallow</code> in <a href=\"/robots.txt\">robots.txt</a>." : `<a href="/about">About</a> &middot; <a href="/privacy">What we record</a> &middot; <a href="/survey">Survey</a> &middot; <a href="/audit">Architecture verification</a> &middot; <a href="/status">Status</a> &middot; <a href="/about#contact">Corrections</a> &middot; <a href="/robots.txt">robots.txt</a> &middot; <a href="/llms.txt">llms.txt</a>`}</p>
</footer>
</div>
</body>
</html>`;
}
