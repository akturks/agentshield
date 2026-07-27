import { page, escapeHtml, instant, recorded } from "../layout.js";
import { notOperator } from "../stats.js";
import db from "../realityDb.js";
import { allCanaries } from "../canary.js";
import { headline, EXTERNAL } from "../stats.js";
import { disallowedPaths } from "./content.js";
import { classify, SNAPSHOT_DATE } from "../vendors/index.js";
import { AI_AGENT_PATTERNS } from "../findings/detectors.js";

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

/**
 * Declared identities, tallied against the vendors' own published address ranges.
 *
 * The table above this one counts what clients *say*. This one counts how many of
 * those claims the vendor's own list corroborates, which is the difference between
 * a number anybody can inflate and a number that requires OpenAI's infrastructure
 * to inflate.
 *
 * Four outcomes, and only one of them is evidence against a client:
 *  - verified      the address is in the list the vendor publishes for that agent
 *  - vendor_other  a different range belonging to the same vendor
 *  - unlisted      the vendor publishes a list and this address is not on it
 *  - unverifiable  no published list exists to check against
 *
 * `unverifiable` is a gap in the vendor's publishing, never an accusation: Anthropic
 * and Common Crawl publish nothing machine-readable, so every Claude agent lands
 * here no matter how genuine it is.
 *
 * Classification runs against a dated snapshot, never a live fetch, so this table
 * reproduces. A live list would give a different answer next month with no way to
 * tell which answer was right.
 */
function verifiedIdentities() {
  const out = [];

  for (const pattern of AI_AGENT_PATTERNS) {
    const rows = db
      .prepare(
        `SELECT cfConnectingIp AS ip, COUNT(*) AS hits
         FROM RequestReality
         WHERE ${EXTERNAL} AND userAgent LIKE ?
         GROUP BY cfConnectingIp`
      )
      .all(`%${pattern}%`);

    if (rows.length === 0) continue;

    const tally = { verified: 0, vendor_other: 0, unlisted: 0, unverifiable: 0 };
    let hits = 0;
    let reason = null;

    for (const row of rows) {
      const result = classify(pattern, row.ip);
      tally[result.status] = (tally[result.status] ?? 0) + row.hits;
      hits += row.hits;
      if (result.status === "unverifiable") reason = reason ?? result.reason;
    }

    out.push({ pattern, hits, addresses: rows.length, ...tally, reason });
  }

  return out.sort((a, b) => b.hits - a.hits);
}

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

export function lab(canary, published) {
  const total = countAll.get().n;
  const since = firstSeen.get().t;
  const agents = distinctAgents.get().n;
  const ips = distinctIps.get().n;
  const jsAgents = jsCapable.get().n;
  const canaries = allCanaries();
  const violations = disallowedHits();
  const formats = formatPrefs.all();

  const agentRows = topAgents.all();
  const referred = referredArrivals.all();
  const identities = verifiedIdentities();

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

<p class="lede">Most of the traffic arriving at a website is no longer people, and almost nothing is publicly established about what those clients actually do. This page is one domain answering that question about itself, out loud, from the first request onward.</p>

<h2>What we are doing here</h2>

<p>The question is narrow on purpose: <strong>when an automated client reads a page, what does it do — as opposed to what it says it is?</strong> Every client announces an identity, nothing verifies that announcement, and the gap between the declaration and the record is measurable without anyone's cooperation.</p>

<p>So the method is the whole point. Nothing on this page comes from asking a language model what it knows about this site; that is the system under test testifying about itself, and it is <a href="/lab/methodology">refused as evidence</a> here. What is left is slower and much smaller: requests this server saw, written down once, never edited, and counted in public. <a href="/about">Why this exists</a> covers the longer argument.</p>

<h2>This site is installation number one</h2>

<p>The instrument is a small server that records what it is asked for. This domain is the first place it runs, which makes the site both the instrument and the subject — every figure below was produced by this site watching itself being read. That is a limitation and it is also the reason the numbers can be checked: there is no customer data behind them, no privileged access, and no sample you cannot see.</p>

<p>It also sets the ceiling on what any of it means. One domain is one sample. A new, small site about a niche subject is not the web, and nothing here generalises to it.</p>

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
      SNAPSHOT_DATE ? ` captured ${escapeHtml(SNAPSHOT_DATE)}` : ""
    }, never a live fetch, so every row here reproduces.</p>

${
  identities.length === 0
    ? "<p>No client has yet declared one of the identities this site checks.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Declared identity</th><th>Requests</th><th>Verified</th><th>Vendor's other range</th><th>Unlisted</th><th>Unverifiable</th></tr></thead>
<tbody>${identities
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

<div class="scroll"><table>
<thead><tr><th>Marker</th><th>Page</th><th>Published</th><th>First observed in a model</th></tr></thead>
<tbody>${canaries
      .map(
        (c) =>
          `<tr><td class="mono">${escapeHtml(c.token)}</td><td class="mono">${escapeHtml(c.page)}</td><td>${escapeHtml(instant(c.publishedAt))}</td><td>&mdash;</td></tr>`
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
