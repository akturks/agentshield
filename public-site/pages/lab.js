import { page, escapeHtml, instant, recorded } from "../layout.js";
import { notOperator } from "../stats.js";
import db from "../realityDb.js";
import { allCanaries } from "../canary.js";
import { markerLifecycle } from "../markers.js";
import { headline, EXTERNAL } from "../stats.js";
import { disallowedPaths } from "./content.js";
import { declaredIdentities } from "../identities.js";
import { habits, VISIT_GAP_MS } from "../patterns.js";
import { hypotheses } from "../hypotheses.js";

const countAll = db.prepare(`SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL}`);
const firstSeen = db.prepare(
  `SELECT MIN(observedAt) AS t FROM RequestReality WHERE ${EXTERNAL}`
);
const distinctAgents = db.prepare(
  `SELECT COUNT(DISTINCT userAgent) AS n FROM RequestReality WHERE ${EXTERNAL} AND userAgent IS NOT NULL`
);
const distinctIps = db.prepare(
  `SELECT COUNT(DISTINCT cfConnectingIp) AS n FROM RequestReality WHERE ${EXTERNAL}`
);
const topAgents = db.prepare(`
  SELECT userAgent, COUNT(*) AS hits, MIN(observedAt) AS firstAt, MAX(observedAt) AS lastAt
  FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent IS NOT NULL
  GROUP BY userAgent
  ORDER BY hits DESC, lastAt DESC
  LIMIT 25
`);
const formatPrefs = db.prepare(`
  SELECT routeVariant, COUNT(*) AS hits
  FROM RequestReality
  WHERE ${EXTERNAL} AND routeVariant LIKE 'probe_%'
  GROUP BY routeVariant
  ORDER BY hits DESC
`);
const jsCapable = db.prepare(`
  SELECT COUNT(DISTINCT r.userAgent) AS n
  FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
  WHERE r.cfRay IS NOT NULL AND ${notOperator('r')}
`);

// Arrivals that carry the tag a published link was given. The query string is
// stored verbatim in the reality layer, so this needs no redirect, no cookie and
// no script — and no route that varies its bytes by who is asking, which the
// constitution rules out anyway.
//
// This exists so that a link posted somewhere with an audience does not silently
// become part of the crawler figures above. It separates; it never excludes. An
// untagged arrival is still counted everywhere else on this page.
const referredArrivals = db.prepare(`
  SELECT
    TRIM(REPLACE(SUBSTR(query, INSTR(query, 'from=') + 5), '&', ' ')) AS tag,
    path,
    COUNT(*) AS hits,
    COUNT(DISTINCT cfConnectingIp) AS addresses,
    COUNT(DISTINCT userAgent) AS agents,
    MIN(observedAt) AS firstAt,
    MAX(observedAt) AS lastAt
  FROM RequestReality
  WHERE ${EXTERNAL} AND query LIKE '%from=%'
  GROUP BY tag, path
  HAVING tag <> ''
  ORDER BY hits DESC, lastAt DESC
  LIMIT 25
`);

// How much of the record is one address?
//
// Every total on this page can be inflated by anyone willing to send requests: the
// rate limit allows 240 a minute per address, and nothing here refuses a client for
// being uninteresting. That is a property of an open, honest instrument, not a
// defect to be fixed — refusing traffic would change what is measurable.
//
// What can be fixed is the figure hiding it. A single actor already accounts for an
// eighth of this record (a credential scanner, 90 requests in six seconds), and an
// average that absorbs that silently is a worse number than one that declares it.
// So the largest single contributor is published beside the totals, always.
//
// This is Article VI applied to a threat rather than to a sample size: state the
// weakness in the number, in the same breath as the number.
const concentration = db.prepare(`
  SELECT COUNT(*) AS hits
  FROM RequestReality
  WHERE ${EXTERNAL} AND cfConnectingIp IS NOT NULL AND cfConnectingIp <> ''
  GROUP BY cfConnectingIp
  ORDER BY hits DESC
  LIMIT 1
`);

function disallowedHits() {
  const paths = disallowedPaths();
  const marks = paths.map(() => "?").join(",");
  return db
    .prepare(
      `SELECT path, userAgent, COUNT(*) AS hits, MAX(observedAt) AS lastAt
       FROM RequestReality
       WHERE ${EXTERNAL} AND path IN (${marks})
       GROUP BY path, userAgent
       ORDER BY hits DESC
       LIMIT 25`
    )
    .all(...paths);
}

function truncate(value, max = 90) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function statBlock(stats) {
  return `<div class="grid">${stats
    .map(
      ([label, value]) =>
        `<div><div class="stat">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div>`
    )
    .join("")}</div>`;
}

/**
 * What each corroborated crawler does when it comes back.
 *
 * Counted in visits, not requests. A crawler that arrives once and reads eleven
 * pages has shown an itinerary; one that arrives on six occasions and fetches a
 * single file each time has shown a habit, and counting requests makes the first
 * look like the second — a flattering error that turns one busy afternoon into a
 * behaviour.
 *
 * Only visits from an address the vendor itself publishes are described. On 26
 * July one address sent 90 requests under 13 crawler identities inside a minute;
 * without that filter its itinerary is published as the habit of three separate
 * companies' crawlers. Agents whose vendor publishes no list keep their counts
 * and get no description, which is a limit on what can be known rather than a
 * gap worth filling with a weaker test.
 */
function readingHabits() {
  const rows = habits().filter((h) => h.totalVisits > 0);
  if (rows.length === 0) return "";

  const described = rows.filter((h) => h.describable);

  return `<h2 id="habits">What each crawler does when it comes back</h2>

<p>The tables above count requests. This one counts <strong>visits</strong> — a run of requests from one identity at one address with no pause longer than ${Math.round(VISIT_GAP_MS / 60000)} minutes. The difference decides what may be called behaviour: a crawler that arrives once and reads eleven pages has shown an itinerary, while one that returns on six occasions and fetches a single file each time has shown a habit.</p>

<p>Only visits from an address the vendor itself publishes are described here. A habit is a statement about a company's crawler, and the user agent alone cannot support one — <a href="/findings/identity-rotation-2026-07-26-4545237206">one address on this site presented thirteen crawler identities in a single minute</a>. Its visits are counted below and attributed to nobody.</p>

<div class="scroll"><table>
<thead><tr><th>Declared identity</th><th>Visits</th><th>From an address the vendor publishes</th><th>Days</th><th>Addresses</th><th>What it did</th></tr></thead>
<tbody>${rows
    .map(
      (h) =>
        `<tr><td class="mono">${escapeHtml(h.agent)}</td><td>${h.totalVisits}</td><td>${h.corroboratedVisits}</td><td>${h.days || "—"}</td><td>${h.addresses || "—"}</td><td>${
          h.describable
            ? h.soleTargets.length && h.soleTargets[0].share >= 50
              ? `fetched only <code>${escapeHtml(h.soleTargets[0].path)}</code> on ${h.soleTargets[0].visits} of ${h.corroboratedVisits} visits`
              : `${h.singlePathVisits} of ${h.corroboratedVisits} visits fetched a single path`
            : `<span class="status">not enough to describe — needs ${escapeHtml(h.needs ?? "")}</span>`
        }</td></tr>`
    )
    .join("")}</tbody></table></div>

${
  described.length === 0
    ? `<p>No crawler has yet returned often enough from a corroborated address for anything here to be called a habit.</p>`
    : `<p>${described.length} of ${rows.length} identities have returned often enough for a description. The rest are counted and left undescribed, which is the honest state of a four-day record rather than an omission.</p>`
}

<p>Percentages are of corroborated visits and every one is printed with the count beneath it, because a share of six visits and a share of six hundred read identically and are not the same claim.</p>`;
}

/**
 * Explanations for an observed habit — plural, unranked, each with the
 * observation that would tell it from the others.
 *
 * A single explanation stops the reader looking. "AI clients never reached
 * /pricing, so the links may not be visible" is a conclusion the moment it
 * appears alone, while the record supported four other readings equally well.
 *
 * Where a separating observation is already in the record it has been run, so a
 * candidate arrives supported or contradicted rather than merely stated. One is
 * left open on principle: settling it would mean asking the vendor about its own
 * crawler, which is the kind of evidence this site declines.
 */
function whatWouldSettleIt() {
  const rows = hypotheses();
  if (rows.length === 0) return "";

  const badge = {
    supported: "the record supports this",
    contradicted: "<strong>the record contradicts this</strong>",
    untested: "open"
  };

  return `<h2 id="open-questions">What the record does not settle</h2>

<p>A habit is not an explanation. Each observation below is followed by every reading this record cannot yet tell apart, in a fixed order that is <strong>not</strong> a ranking — putting the likeliest first would be an opinion wearing a measurement's clothes. Where an observation exists that separates two of them, it has been made and the result is printed.</p>

${rows
    .map(
      (h) => `<div class="qa">
<p class="status">Observed</p>
<p><strong>${escapeHtml(h.observation)}</strong></p>
<div class="scroll"><table>
<thead><tr><th>Reading</th><th>What would separate it</th><th>Where the record stands</th></tr></thead>
<tbody>${h.candidates
        .map(
          (c) =>
            `<tr><td>${escapeHtml(c.claim)}</td><td>${escapeHtml(c.separatedBy)}</td><td>${badge[c.status]} — ${escapeHtml(c.evidence)}</td></tr>`
        )
        .join("")}</tbody></table></div>
<p class="status">${h.settled} of ${h.candidates.length} settled by observations already in the record &middot; ${h.open} open &middot; ${escapeHtml(h.version)}</p>
</div>`
    )
    .join("")}

<p>Each entry in the middle column is an experiment written before anyone runs it. That is the intended use: not to pick the pleasing explanation, but to say what would have to be seen for it to be the right one — and then to wait for it.</p>`;
}

export function lab(canary, published) {
  const total = countAll.get().n;
  const since = firstSeen.get().t;
  const agents = distinctAgents.get().n;
  const ips = distinctIps.get().n;
  const jsAgents = jsCapable.get().n;
  const canaries = allCanaries();
  const markers = markerLifecycle();

  // Which markers nothing has ever collected, and whether that set turns out to
  // be the pages robots.txt tells clients to leave alone. When it does, the
  // compliance figure reported further up this page has been reproduced from an
  // unrelated direction: one counts fetches of disallowed paths, this counts
  // markers that never left the building, and neither knows about the other.
  // Computed rather than asserted, because the day a crawler takes one of those
  // paths the sentence has to stop being true on its own.
  const undelivered = markers.markers.filter((m) => m.delivered === 0);
  const disallowed = new Set(disallowedPaths());
  const undeliveredAreAllDisallowed =
    undelivered.length > 0 && undelivered.every((m) => disallowed.has(m.page));
  const violations = disallowedHits();
  const formats = formatPrefs.all();

  const agentRows = topAgents.all();
  const referred = referredArrivals.all();
  const identities = declaredIdentities();

  const busiest = concentration.get()?.hits ?? 0;
  const busiestShare = total > 0 ? Math.round((busiest / total) * 1000) / 10 : 0;

  return page({
    title: "Lab",
    description:
      "Live observations of AI crawlers and agents reading this site. Every figure traces to a recorded request.",
    path: "/lab",
    canary,
    published,
    body: `
<h1>Lab</h1>

<p class="lede">Every figure this site has, recomputed from the record on each
request. This page is the instrument's reading; <a href="/weekly">the weekly
reports</a> are the log of what happened in each week, and <a href="/findings">the
findings</a> are what a person concluded from them.</p>

<p>The question is narrow on purpose: <strong>when an automated client reads a page,
what does it do — as opposed to what it says it is?</strong> Nothing here comes from
asking a language model what it knows about this site. That is the system under test
testifying about itself, and it is <a href="/lab/methodology">refused as evidence</a>;
the <a href="/lab/methodology">methodology</a> states what would make each figure below
wrong before the figure is offered.</p>

<h2>The record so far</h2>

<p>Figures count <strong>external traffic only</strong> — requests that arrived over the public internet from an address this project does not operate from. Building and testing the instrument generated ${escapeHtml(String(headline().instrument))} further requests, which are kept in the record, excluded from these figures, and <a href="#counting">accounted for below</a> rather than deleted.</p>

${statBlock([
  ["External requests", total.toLocaleString("en-US")],
  ["Distinct user agents", agents.toLocaleString("en-US")],
  ["Distinct client IPs", ips.toLocaleString("en-US")],
  ["Markers published", String(canaries.length)]
])}

<p>${
      since
        ? `Observation began <strong>${escapeHtml(since.slice(0, 19).replace("T", " "))} UTC</strong>.`
        : "No requests have been observed yet."
    }</p>

${
  busiest > 0
    ? `<p><strong>One address accounts for ${escapeHtml(busiest.toLocaleString("en-US"))} of those requests — ${escapeHtml(String(busiestShare))}% of the total.</strong> Anyone can add to these counts; the rate limit permits 240 requests a minute per address and no client is refused for being uninteresting. Refusing traffic would change what is measurable here, so the concentration is published instead of prevented: if a single source ever dominates this record, that figure says so before any conclusion is drawn from it. The identity table below is the part that cannot be inflated this way.</p>`
    : ""
}

${
  total < 50
    ? `<p><em>The record is still small. Figures on this page are published from the first request onward rather than held back, so the dataset can be watched as it accumulates. Treat early numbers as a record of what happened, not as a finding about crawler behaviour in general.</em></p>`
    : ""
}

<h2>Declared clients</h2>

<p>User-Agent strings are claims, not verified identities. They are recorded verbatim and counted as-is. <a href="#checked">The next table</a> reports how many of those claims the vendor's own published address ranges corroborate.</p>

${
  agentRows.length === 0
    ? "<p>No clients observed yet.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>User agent (claimed)</th><th>Requests</th><th>First seen</th><th>Last seen</th></tr></thead>
<tbody>${agentRows
        .map(
          (r) =>
            `<tr><td class="mono">${recorded(truncate(r.userAgent))}</td><td>${r.hits}</td><td>${escapeHtml(instant(r.firstAt))}</td><td>${escapeHtml(instant(r.lastAt))}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

<h2 id="checked">Declared identities, checked against the vendor's list</h2>

<p>The table above counts what clients say. This one counts how far each claim is corroborated by the address ranges the vendor itself publishes — the difference between a figure anybody can inflate and one that would require the vendor's own infrastructure to inflate. Checked against a dated snapshot${
      identities.snapshot ? ` captured ${escapeHtml(identities.snapshot)}` : ""
    }, never a live fetch, so every row here reproduces.</p>

${
  identities.byAgent.length === 0
    ? "<p>No client has yet declared one of the identities this site checks.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Declared identity</th><th>Requests</th><th>Verified</th><th>Vendor's other range</th><th>Unlisted</th><th>Unverifiable</th></tr></thead>
<tbody>${identities.byAgent
        .map(
          (r) =>
            `<tr><td class="mono">${escapeHtml(r.pattern)}</td><td>${r.hits}</td><td>${r.verified}</td><td>${r.vendor_other}</td><td>${r.unlisted}</td><td>${r.unverifiable}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

<p><strong>Only <em>unlisted</em> is evidence against a client</strong>, and what it means is narrow: the vendor publishes a list of its addresses and this request did not come from one. It is never a statement about intent. <em>Unverifiable</em> is a gap in the vendor's publishing rather than anything about the client — Anthropic and Common Crawl publish no machine-readable list, so every one of their agents lands there however genuine it is, and a vendor's silence must not be rendered as an accusation.</p>

<p>Both this table and the concentration figure above exist because of what the CDN
was found to be doing to this site: <a href="/cdn-interventions">what the CDN did,
and when it stopped</a>.</p>

${readingHabits()}

${whatWouldSettleIt()}

<h2>robots.txt compliance</h2>

<p>Three paths are disallowed in <a href="/robots.txt">robots.txt</a> and serve ordinary content. Any fetch listed here is an observed request to a path its own rules asked clients not to take. This table does not distinguish clients that read robots.txt from those that never requested it.</p>

${
  violations.length === 0
    ? "<p>No requests to disallowed paths observed yet.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Path</th><th>User agent (claimed)</th><th>Fetches</th><th>Last</th></tr></thead>
<tbody>${violations
        .map(
          (r) =>
            `<tr><td class="mono">${escapeHtml(r.path)}</td><td class="mono">${recorded(truncate(r.userAgent, 60))}</td><td>${r.hits}</td><td>${escapeHtml(instant(r.lastAt))}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

<h2>Format preference</h2>

<p>The same content is served in several shapes. Counts are fetches of each variant.</p>

${
  formats.length === 0
    ? "<p>No probe fetches observed yet.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Variant</th><th>Fetches</th></tr></thead>
<tbody>${formats
        .map(
          (r) =>
            `<tr><td class="mono">${escapeHtml(r.routeVariant)}</td><td>${r.hits}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

<h2>JavaScript execution</h2>

<p>${jsAgents} distinct user agent${jsAgents === 1 ? " has" : "s have"} demonstrably executed JavaScript, measured by reaching the beacon on <a href="/probe/js">the JS probe</a> rather than by inference.</p>

<h2>Published markers</h2>

<p>Each coined string below was published at the instant recorded against it. None existed anywhere before that moment. The interval between publication and a marker's first appearance in a model's output is the measurement this site exists to produce; that column stays empty until an appearance is observed.</p>

<p>Between those two states there is a third, and it is the one that says whether the
measurement is running at all. A marker only has a chance of reaching a model if
something collected it first. <strong>${markers.everDelivered} of
${markers.total}</strong> markers have been served to at least one external client,
in ${markers.deliveries} deliveries; <strong>${markers.neverDelivered}</strong>
${markers.neverDelivered === 1 ? "has" : "have"} never left this server for anyone but
us. A marker in that state is not waiting slowly — it is not yet in the experiment.</p>

${
  undeliveredAreAllDisallowed
    ? `<p>Every marker in that state sits on a page <a href="/robots.txt">robots.txt</a>
tells clients to leave alone: ${undelivered
        .map((m) => `<code>${escapeHtml(m.page)}</code>`)
        .join(", ")}. Those pages serve ordinary content and are linked in the sitemap;
nothing stops a client taking them. That the only markers never collected are exactly
the ones asked for politely is the robots.txt compliance figure above, arrived at from
the opposite direction &mdash; one counts fetches that happened, this counts strings
that never left the building.</p>`
    : ""
}

<p>Delivery counts responses that carried a body. A conditional request answered
<code>304</code> sends no bytes, so a client told nothing had changed did not receive
the marker on that visit however plainly it asked for the page; those are counted
separately. And a delivery is not a reading: it establishes that the string left this
machine and reached a client, which is the most any server can observe.</p>

<div class="scroll"><table>
<thead><tr><th>Marker</th><th>Page</th><th>Published</th><th>Delivered</th><th>Agents</th><th>Last delivery</th><th>Seen in a model</th></tr></thead>
<tbody>${markers.markers
      .map(
        (c) =>
          `<tr><td class="mono">${escapeHtml(c.token)}</td><td class="mono">${escapeHtml(c.page)}</td><td>${escapeHtml(instant(c.publishedAt))}</td><td>${c.delivered}${c.notModified > 0 ? ` <span class="status">+${c.notModified} not modified</span>` : ""}</td><td>${c.agents}</td><td>${escapeHtml(instant(c.lastDelivered) || "—")}</td><td>&mdash;</td></tr>`
      )
      .join("")}</tbody></table></div>

<h2>Referred arrivals</h2>

<p>Links to this site are published with a tag in the address — <code>?from=</code> — and the query string is recorded exactly as it arrived. That makes an arrival sent by something we posted separable from the ambient automated traffic this page exists to measure, without a redirect, a cookie, a script, or a page that changes its bytes depending on who is asking.</p>

<p>The distinction matters here more than it would on an ordinary site. Every figure above is about how machines read a page; a few hundred people arriving from one post in one afternoon would move all of them at once, and afterwards there would be no way to say which requests were the thing being measured. Tagged arrivals are listed separately for that reason. <strong>Nothing is excluded — they are counted in the totals above as well.</strong> Arrivals from an untagged copy of a link are simply indistinguishable, and are not estimated.</p>

${
  referred.length === 0
    ? "<p>No tagged arrivals observed yet. Every external request recorded so far reached this site without being sent by anything we published.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Tag</th><th>Page</th><th>Requests</th><th>Addresses</th><th>Agents</th><th>First</th><th>Last</th></tr></thead>
<tbody>${referred
        .map(
          (r) =>
            `<tr><td class="mono">${escapeHtml(truncate(r.tag, 24))}</td><td class="mono">${escapeHtml(truncate(r.path, 32))}</td><td>${r.hits}</td><td>${r.addresses}</td><td>${r.agents}</td><td>${escapeHtml(instant(r.firstAt))}</td><td>${escapeHtml(instant(r.lastAt))}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

<h2 id="counting">What these figures exclude, and who decided</h2>

<p>Two rules remove requests from everything above, and they are reported separately because one of them is a judgement call. ${escapeHtml(String(headline().excludedByHeuristic))} requests are excluded because they came from an address that has also driven this site from a command line — an inference from the record itself. A further ${escapeHtml(String(headline().excludedByDeclaration))} are excluded because they came from an address <strong>declared</strong> as ours: ${headline().declaredAddresses.map((a) => `<code>${escapeHtml(a)}</code>`).join(", ")}.</p>

<p>The second rule is the only mechanism on this site that can remove genuine observations from a published figure, so its effect is printed here rather than described. It exists because the inference is not enough: a phone that never runs <code>curl</code> is invisible to it, and this machine's IPv6 address rotates daily, which made the same laptop look like a new visitor 13 times on 25 July 2026. The declared list lives in versioned source, not in the database, so every change to it is in the history.</p>

${
  headline().unresolvedOperator
    ? `<p><strong>${escapeHtml(String(headline().unresolvedOperator))} of the external requests above are probably ours and are counted anyway.</strong> They come from ${escapeHtml(String(headline().unresolvedOperatorIps))} addresses in a Turkish mobile carrier's pool, sending the exact <code>Accept-Language</code> header that the declared operator machine sends — a list no other client here has ever sent. It is almost certainly a phone of ours.</p>

<p>It stays in the count for two reasons. A carrier-pool address identifies a carrier and not a person: declaring one would exclude whichever customer holds it next, and the phone will have a different address tomorrow, so the exclusion would delete real observations while failing at its purpose. Matching on the header instead would work, and is worse — <a href="/constitution">Article VII</a> says the unit of observation is a request rather than a person, and identifying someone by their combination of headers is exactly the technique it rules out. A codebase that holds that capability for self-exclusion holds it for everything else.</p>

<p>So the figure is stated rather than corrected. Every external count on this site is up to ${escapeHtml(String(Math.round((headline().unresolvedOperator / Math.max(1, headline().external)) * 100)))}% too high for this reason, and that is a more useful thing to publish than a tidier number.</p>`
    : ""
}

<h2>Method</h2>

<p>How these figures are produced, and what would make them wrong, is described in the <a href="/lab/methodology">methodology</a>. The rules the whole instrument is bound by are in the <a href="/constitution">constitution</a>, and the same method turned on this project's own source code produces the <a href="/audit">architecture audit</a>.</p>
`
  });
}

export function methodology(canary, published) {
  return page({
    title: "Methodology",
    description:
      "How observations are captured, what counts as evidence here, and the known limits of the measurement.",
    path: "/lab/methodology",
    canary,
    published,
    body: `
<h1>Methodology</h1>

<p class="lede">What counts as evidence on this site, how it is collected, and where the method is weak.</p>

<h2>Admissible evidence</h2>

<p>One thing only: a request this server observed and recorded. Method, headers, timing, status, bytes. Records are written once and never modified, and they carry no verdicts — a stored judgement would overwrite the evidence needed to check it.</p>

<h2>Inadmissible evidence</h2>

<p><strong>Model self-report.</strong> We do not prompt a language model about this site and record its answer as data. A model describing its own knowledge is the system under test testifying about itself; it can assert familiarity with pages it never read and deny ones it did. This exclusion rules out the common approach to AI visibility measurement, which is the point rather than an oversight.</p>

<p><strong>Inference presented as observation.</strong> That a client "is a bot" is a conclusion. That a client sent a given User-Agent and fetched given paths at given times is an observation. Only the second is stored.</p>

<h2>Interpretation is separate and versioned</h2>

<p>Signals derived from observations are written to their own table, tagged with the version of the interpreter that produced them. Improving the interpreter means deleting the prior version's output and recomputing over the same untouched observations. A conclusion that cannot be re-derived from the record does not get published.</p>

<h2>Known limits</h2>

<ul>
<li><strong>User-Agent strings are unverifiable.</strong> Anyone can send any string. Counts by declared agent are counts of claims, and some fraction of traffic claiming to be a given crawler is not.</li>
<li><strong>Robots compliance is measured imprecisely.</strong> A fetch of a disallowed path proves the fetch happened, not that the client read robots.txt and chose to ignore it. Distinguishing those requires correlating a robots.txt fetch with the same client beforehand, which is only reliable when the client is consistent.</li>
<li><strong>One site is one sample.</strong> Everything here describes how AI clients treat this specific domain — new, small, and about a niche subject. Generalising to the web at large is not supported by this dataset.</li>
<li><strong>Absence of a marker proves little.</strong> A coined string not appearing in a model's output may mean the page was never ingested, or that it was ingested and not surfaced. Appearance is strong evidence; non-appearance is weak evidence.</li>
<li><strong>Client IPs arrive via a proxy.</strong> The site is served through Cloudflare, so the connecting address is taken from a proxy-supplied header. Both that header and the raw socket address are stored, unmodified.</li>
</ul>

<h2>Privacy</h2>

<p>No cookies, no fingerprinting scripts, no cross-site tracking, no accounts. The unit of observation is a request. Published tables report user agents, paths, and counts — never anything that identifies a person.</p>

<h2>Reproducing this</h2>

<p>The instrument is a small server that records requests and a set of pages designed to make specific behaviours measurable: disallowed paths for compliance, a script-rendered page for JavaScript execution, several formats of identical content for format preference, and coined markers for ingestion. None of it requires special access. Any site owner can build the same thing.</p>
`
  });
}
