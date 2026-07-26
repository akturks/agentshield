import { escapeHtml } from "../layout.js";

// Turns a detector candidate into prose. No language model is involved: every
// sentence is a fixed template and every number comes from the detector, which
// got it from a query the verifier will re-run.
//
// The writing is plainer than a person would produce. That is the trade — a
// generated sentence that cannot invent a figure is worth more here than a
// fluent one that might.

export const TEMPLATE_VERSION = "tpl-5";

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
      // The claim is the ordering: rules first, then the paths they forbade.
      // "After reading robots.txt" carries that in a preposition, which is the
      // first thing a translator loosens. Two clauses in sequence survive it.
      title: `This client read our robots.txt first, then took ${c.facts.hits} path${c.facts.hits === 1 ? "" : "s"} it forbids`,
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
    const hits = c.facts.hits ?? Number(c.claims[0].expected);
    const prompted = c.facts.prompted ?? 0;
    const allOurs = prompted > 0 && prompted === hits;

    // The headline is the part that gets indexed, quoted and shared, so the
    // reconciliation with our own trials belongs there and not only in a
    // paragraph further down. "Has been observed" implies nobody asked; when we
    // did ask, the title says so.
    //
    // We are the subject of that sentence on purpose. An earlier version read
    // "<agent> fetched this site inside a trial we ran", which put our own part
    // in a subordinate clause — and machine translation duly dropped it, turning
    // "fetched" into "found" and handing the claim back to the crawler. A claim
    // carried by one verb can be reversed by one mistranslation; a claim carried
    // by the subject cannot.
    const title = allOurs
      ? `We asked ${c.facts.agent} to read this page, and it did`
      : `${c.facts.agent} has been observed on this site`;

    const summary = allOurs
      ? `A client declaring ${c.facts.agent} made ${hits} request${hits === 1 ? "" : "s"} across ${c.facts.paths} distinct path${c.facts.paths === 1 ? "" : "s"} on ${day(c.windowStartMs)}. Every one of them arrived inside a window in which we had asked this vendor to read a page here, so this is the result of a trial rather than an unprompted visit.`
      : `A client declaring ${c.facts.agent} made ${hits} request${hits === 1 ? "" : "s"} across ${c.facts.paths} distinct path${c.facts.paths === 1 ? "" : "s"}, first seen ${day(c.windowStartMs)}.${prompted ? ` ${prompted} of those requests fall inside a trial we ran.` : ""}`;

    return {
      slug: `ai-agent-arrival-${c.facts.agent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      summary,
      body: `
<h2>What was observed</h2>
<p>First request ${fmt(c.windowStartMs)} UTC, most recent ${fmt(c.windowEndMs)} UTC.</p>
<table>
<tbody>
<tr><th>Declared agent</th><td><code>${escapeHtml(c.facts.agent)}</code></td></tr>
<tr><th>Requests</th><td>${hits}</td></tr>
<tr><th>Distinct paths</th><td>${c.facts.paths}</td></tr>
<tr><th>Distinct addresses</th><td>${c.facts.ips}</td></tr>
<tr><th>Inside a trial we ran</th><td>${prompted} of ${hits}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
${
  allOurs
    ? `<p><strong>We caused this.</strong> All ${hits} requests arrived inside a window in which we had asked this vendor to read a page here, so nothing on this page describes a client finding the site on its own. What it does describe is what that vendor's fetcher actually did once asked — which paths it took, whether it read robots.txt first, whether it ran the script — and that is worth recording even though we started it.</p>
<p>Strictly, arriving inside the window is correlation and not proof of cause; an unrelated visit could land in the same ten minutes. Here the correlation is not the reason for the claim — we know we asked, and the trial log says so.</p>`
    : prompted
      ? `<p>Arrival is the entire event. This records that a client presenting this identity reached the site and what it took; it does not establish why it came, whether the content was retained, or whether it will return.</p>
<p><strong>Part of this traffic may be our own doing.</strong> ${prompted} of these ${hits} requests arrived inside a window in which we had asked this vendor to read a page here. That is a correlation over time, not a proven cause, but it is the one explanation the observation record can never contain — so it is stated here rather than left for a reader to wonder about.</p>`
      : `<p>Arrival is the entire event. This records that a client presenting this identity reached the site and what it took; it does not establish why it came, whether the content was retained, or whether it will return.</p>
<p>No registered trial of ours was running when any of this arrived. That is not proof it came unprompted: it means only that if something of ours caused it, the cause was not written down, which is a gap in our record-keeping rather than evidence either way.</p>`
}
${limits([
  UA_CLAIM_LIMIT,
  "Fetching is not ingestion. Whether any of this content persists in a model is measured separately, by the coined markers listed on the lab page.",
  "An arrival cannot be shown to be unprompted. Nothing in a request says why it was made, so “nobody asked for this” rests entirely on our own trial log being complete.",
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

  distributed_crawl(c) {
    const share = Math.round((c.facts.singles / c.facts.ips) * 100);
    return {
      slug: `distributed-crawl-${day(c.windowStartMs)}-${c.facts.ua.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`,
      title: `One user agent, ${c.facts.ips} addresses, ${c.facts.paths} paths — a retrieval spread thin enough to look like nothing`,
      summary: `A single user agent string arrived from ${c.facts.ips} distinct addresses in ${c.facts.countries} countries over ${c.facts.hours} hours. ${c.facts.singles} of those addresses sent exactly one request. Between them they fetched ${c.facts.paths} distinct paths.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC:</p>
<table>
<tbody>
<tr><th>Declared agent</th><td><code>${escapeHtml(c.facts.ua)}</code></td></tr>
<tr><th>Distinct addresses</th><td>${c.facts.ips}</td></tr>
<tr><th>Addresses used exactly once</th><td>${c.facts.singles} (${share}%)</td></tr>
<tr><th>Distinct paths fetched</th><td>${c.facts.paths}</td></tr>
<tr><th>Countries</th><td>${c.facts.countries}</td></tr>
<tr><th>Total requests</th><td>${c.facts.hits}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
<p>Every request here is unremarkable on its own. One address, one page, an ordinary browser string — nothing that any rate limit or per-address rule would react to. The pattern only exists when the requests are grouped by what they claimed to be rather than where they came from.</p>
<p>This is the blind spot in the other rule on this site. <a href="/findings">Automated enumeration</a> groups by address and asks which client took many paths quickly; a retrieval arranged one request per address is precisely what that question cannot see. The two rules fail in opposite directions, and neither is a substitute for the other.</p>
<p>What the counts establish is coverage without concentration: a large share of this site's pages was fetched, and almost no address fetched more than one of them. What they do not establish is that one party arranged it. That inference is the obvious one, and it is still an inference.</p>
${limits([
  UA_CLAIM_LIMIT,
  "Shared user agent strings are not evidence of a shared operator. A common mobile browser behind carrier NAT can produce many addresses sending one request each, from unrelated people, with no coordination at all.",
  "Country is Cloudflare's geolocation of the connecting address. It describes where the address resolves, not where the client or its operator is.",
  "The thresholds — how many addresses, how few requests each — are chosen parameters. A retrieval spread more thinly still falls below them and is not reported.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  arrival_host(c) {
    const { canonical, hosts, aiOnCanonical, aiElsewhere, otherHostRequests } = c.facts;
    const aiTotal = aiOnCanonical + aiElsewhere;
    const allOnCanonical = aiElsewhere === 0 && aiOnCanonical > 0;

    return {
      slug: `arrival-host-${day(c.windowEndMs)}`,
      title: allOnCanonical
        ? `Every declared AI crawler arrived on one of our two hostnames — the one we announced`
        : `Declared AI crawlers arrived on ${new Set([canonical]).size + (aiElsewhere ? 1 : 0)} of our hostnames`,
      summary: `This site answers on ${hosts.length} hostnames, both serving every path. Of ${aiTotal} request${aiTotal === 1 ? "" : "s"} from clients declaring a known AI crawler, ${aiOnCanonical} arrived on ${canonical} and ${aiElsewhere} elsewhere — while ${otherHostRequests} other external requests used a non-canonical hostname.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC. Both hostnames return <code>200</code> for every path and carry a canonical tag pointing at <code>${escapeHtml(canonical)}</code>; there is no redirect between them.</p>
<table>
<thead><tr><th>Hostname</th><th>External requests</th></tr></thead>
<tbody>
${hosts.map((h) => `<tr><td><code>${escapeHtml(h.host)}</code>${h.host === canonical ? " (canonical)" : ""}</td><td>${h.n}</td></tr>`).join("\n")}
</tbody>
</table>
<table>
<tbody>
<tr><th>AI-crawler requests on ${escapeHtml(canonical)}</th><td>${aiOnCanonical}</td></tr>
<tr><th>AI-crawler requests on any other hostname</th><td>${aiElsewhere}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
${
  allOnCanonical
    ? `<p>Every client declaring a known AI crawler used the hostname we announced to the indexes, and none used the other one. Other automated traffic did not divide the same way — ${otherHostRequests} external requests arrived on a non-canonical hostname, including a distributed retrieval that used it almost exclusively.</p>
<p>The obvious reading is that these are two different discovery routes: a crawler that came from an index we submitted to arrives on the name we submitted, and a crawler that found the site some other way — enumerating DNS, reading certificate transparency logs, working from a list — arrives on whichever name that source held. The counts here are consistent with that and do not establish it. ${aiTotal} requests is not enough to establish anything about crawler behaviour in general.</p>`
    : `<p>Declared AI crawlers used more than one of our hostnames, so arrival hostname does not separate them from other automated traffic here.</p>`
}
<p>This is also why the two hostnames were left in place. Serving one canonical host is the ordinary advice, and a redirect was the first thing considered — but no figure published here is computed per hostname, so nothing was being corrupted, and the redirect would have made every future arrival look identical. The untidiness is carrying information, so it stays and is measured instead.</p>
${limits([
  UA_CLAIM_LIMIT,
  `Sample size. ${aiTotal} AI-crawler request${aiTotal === 1 ? "" : "s"} in total. This is a description of what has arrived here, not a result about how crawlers behave.`,
  "Requests on the non-canonical hostname include traffic that is probably our own — see the note on unresolved operator traffic on the lab page. The AI-crawler figures are unaffected by it, since none of that traffic declares an AI crawler.",
  "Hostname is the Host header as received. It records the name the client asked for, not how the client learned it; the discovery route is an inference and is not recorded anywhere.",
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
