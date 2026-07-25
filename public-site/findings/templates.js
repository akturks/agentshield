import { escapeHtml } from "../layout.js";

// Turns a detector candidate into prose. No language model is involved: every
// sentence is a fixed template and every number comes from the detector, which
// got it from a query the verifier will re-run.
//
// The writing is plainer than a person would produce. That is the trade — a
// generated sentence that cannot invent a figure is worth more here than a
// fluent one that might.

export const TEMPLATE_VERSION = "tpl-1";

const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

function limits(items) {
  return `<h2>Limits</h2>\n<ul>\n${items.map((l) => `<li>${l}</li>`).join("\n")}\n</ul>`;
}

const UA_CLAIM_LIMIT =
  "The declared user agent is unverified. Any client can send any string, so this describes a claim rather than a confirmed identity.";
const SINGLE_SITE_LIMIT =
  "One domain, observed continuously. Nothing here generalises to how this client behaves elsewhere.";

const TEMPLATES = {
  robots_violation(c) {
    const ua = c.facts.ua ?? "an undeclared client";
    return {
      slug: `robots-violation-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      title: `A client fetched disallowed paths after reading robots.txt`,
      summary: `A client declaring ${ua} requested /robots.txt and subsequently fetched ${c.facts.hits} path${c.facts.hits === 1 ? "" : "s"} listed under Disallow. The rules were retrieved before the paths were taken.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, a single connecting address requested <code>/robots.txt</code> and afterwards fetched <strong>${c.facts.hits}</strong> path${c.facts.hits === 1 ? "" : "s"} that the same file lists under <code>Disallow</code>.</p>
<p>Declared identity: <code>${escapeHtml(ua)}</code></p>
<p>The disallowed paths on this site serve ordinary content and return <code>200</code>. Nothing is hidden there and nothing is trapped; they exist so that compliance is measurable rather than assumed.</p>
<h2>What it means</h2>
<p>This is the strong form of a compliance failure. The client did not merely take a disallowed path — it retrieved the rules first, so the rules were available to it. robots.txt carries no enforcement, so nothing was broken in a technical sense; what was recorded is that the request was made after the preference had been read.</p>
${limits([
  UA_CLAIM_LIMIT,
  "Ordering is established by timestamp on the same connecting address. A client behind a shared address, or one rotating addresses, may be misattributed.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  ai_agent_arrival(c) {
    return {
      slug: `ai-agent-arrival-${c.facts.agent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${c.facts.agent} has been observed on this site`,
      summary: `A client declaring ${c.facts.agent} made ${c.claims[0].expected} request${c.claims[0].expected === "1" ? "" : "s"} across ${c.facts.paths} distinct path${c.facts.paths === 1 ? "" : "s"}, first seen ${day(c.windowStartMs)}.`,
      body: `
<h2>What was observed</h2>
<p>First request ${fmt(c.windowStartMs)} UTC, most recent ${fmt(c.windowEndMs)} UTC.</p>
<table>
<tbody>
<tr><th>Declared agent</th><td><code>${escapeHtml(c.facts.agent)}</code></td></tr>
<tr><th>Requests</th><td>${c.claims[0].expected}</td></tr>
<tr><th>Distinct paths</th><td>${c.facts.paths}</td></tr>
<tr><th>Distinct addresses</th><td>${c.facts.ips}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
<p>Arrival is the entire event. This records that a client presenting this identity reached the site and what it took; it does not establish why it came, whether the content was retained, or whether it will return.</p>
${limits([
  UA_CLAIM_LIMIT,
  "Fetching is not ingestion. Whether any of this content persists in a model is measured separately, by the coined markers listed on the lab page.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  automated_enumeration(c) {
    return {
      slug: `automated-enumeration-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      title: `One address requested ${c.facts.paths} distinct paths within ${c.facts.seconds} seconds`,
      summary: `A single connecting address took ${c.facts.paths} distinct paths in ${c.facts.seconds} seconds, a rate no interactive session produces.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, one connecting address requested <strong>${c.facts.paths}</strong> distinct paths.</p>
<p>Declared identity: <code>${escapeHtml(c.facts.ua ?? "(none sent)")}</code></p>
<h2>What it means</h2>
<p>The rate distinguishes systematic retrieval from reading. It does not establish intent — a well-behaved archiver and a scanner looking for an unpatched installation produce a similar shape, and separating them requires looking at which paths were chosen rather than how many.</p>
${limits([
  UA_CLAIM_LIMIT,
  "The threshold is a chosen parameter, not a natural boundary. A slower client doing the same thing falls below it.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  identity_inconsistency(c) {
    return {
      slug: `identity-inconsistency-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      title: `One address presented contradictory identities, including a well-known AI crawler`,
      summary: `A single connecting address sent ${c.facts.identities} different user agent strings, among them ${c.facts.claimedAgents.length} matching a known AI crawler and at least one plain command-line client. At most one of these claims can describe the same software.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, one connecting address presented <strong>${c.facts.identities}</strong> distinct user agent strings.</p>
<p>Among them, ${c.facts.claimedAgents.length} matched a known AI crawler:</p>
<ul>
${c.facts.claimedAgents.map((a) => `<li><code>${escapeHtml(a)}</code></li>`).join("\n")}
</ul>
<p>The same address also sent a plain command-line client agent such as <code>curl</code> or <code>Python-urllib</code>.</p>
<h2>What it means</h2>
<p>Major AI crawlers operate from their own infrastructure and do not share an address with an interactive shell. An address making both claims is presenting at least one identity that is not its own.</p>
<p>This does not identify who was responsible or why. It may be testing, a proxy carrying unrelated traffic, or deliberate impersonation. What the record establishes is narrower and firmer: the declared identity on that address cannot be taken at face value, which is the reason this observatory stores user agents as claims and counts them as claims.</p>
${limits([
  "A shared address — a proxy, a VPN exit, a corporate gateway — can carry unrelated clients and produce this pattern without any impersonation.",
  "This rule detects contradiction, not authenticity. It cannot confirm that an agent presenting a single consistent identity is genuine.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  js_execution(c) {
    return {
      slug: `js-execution-${(c.facts.ua ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      title: `A client executed JavaScript on this site`,
      summary: `A client declaring ${c.facts.ua ?? "no user agent"} reached the beacon on the script-rendered probe ${c.facts.beacons} time${c.facts.beacons === 1 ? "" : "s"}, which requires having executed the page's script.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, a client reached the beacon URL <strong>${c.facts.beacons}</strong> time${c.facts.beacons === 1 ? "" : "s"}.</p>
<p>Declared identity: <code>${escapeHtml(c.facts.ua ?? "(none sent)")}</code></p>
<h2>What it means</h2>
<p>The beacon is requested only by the script embedded in the probe page. Reaching it therefore requires having executed that script — this is observed capability rather than capability inferred from a user agent string.</p>
${limits([
  UA_CLAIM_LIMIT,
  "This establishes execution on these visits. It does not establish that the client executes scripts generally, nor that it does so when crawling other sites.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  format_preference(c) {
    const rows = c.facts.rows;
    return {
      slug: `format-preference-${day(c.windowEndMs)}`,
      title: `Which content formats are actually fetched`,
      summary: `Across ${c.facts.total} fetches of identical content published in several formats, ${rows[0].variant} was requested most often (${rows[0].hits}).`,
      body: `
<h2>What was observed</h2>
<p>The same statement is published as HTML, JSON, Markdown, plain text and RSS, each linked equally and listed in the sitemap. Fetches between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC:</p>
<table>
<thead><tr><th>Variant</th><th>Fetches</th></tr></thead>
<tbody>
${rows.map((r) => `<tr><td><code>${escapeHtml(r.variant)}</code></td><td>${r.hits}</td></tr>`).join("\n")}
</tbody>
</table>
<h2>What it means</h2>
<p>Counts of what was requested, nothing more. A fetched format may have been discarded, and a format not fetched may simply never have been discovered despite equal linking.</p>
${limits([
  "Fetch counts are not preference. They record retrieval, not what was used or retained.",
  "Traffic here includes ordinary browsers and scanners as well as AI clients; this figure is not filtered to AI agents alone.",
  SINGLE_SITE_LIMIT
])}`
    };
  }
};

export function render(candidate) {
  const template = TEMPLATES[candidate.detectorId];
  if (!template) return null;
  const out = template(candidate);
  return { ...out, slug: out.slug.replace(/-+/g, "-").replace(/-$/, "") };
}
