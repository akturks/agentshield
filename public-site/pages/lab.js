import { page, escapeHtml } from "../layout.js";
import { notOperator } from "../stats.js";
import db from "../realityDb.js";
import { allCanaries } from "../canary.js";
import { headline, EXTERNAL } from "../stats.js";
import { disallowedPaths } from "./content.js";

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

  return page({
    title: "Lab",
    description:
      "Live observations of AI crawlers and agents reading this site. Every figure traces to a recorded request.",
    path: "/lab",
    canary,
    published,
    body: `
<h1>Lab</h1>

<p class="lede">Everything below is computed from requests observed by this server. Nothing here comes from asking a model what it knows.</p>

<p>Figures count <strong>external traffic only</strong>: requests that arrived over the public internet from an address this project does not operate from. Building and testing the instrument generated ${escapeHtml(String(headline().instrument))} further requests, which are kept in the record, excluded here, and never deleted.</p>

<p>Two rules do that excluding, and they are reported separately because one of them is a judgement call. ${escapeHtml(String(headline().excludedByHeuristic))} requests are excluded because they came from an address that has also driven this site from a command line — an inference from the record itself. A further ${escapeHtml(String(headline().excludedByDeclaration))} are excluded because they came from an address <strong>declared</strong> as ours: ${headline().declaredAddresses.map((a) => `<code>${escapeHtml(a)}</code>`).join(", ")}.</p>

<p>The second rule is the only mechanism on this site that can remove genuine observations from a published figure, so its effect is printed above rather than described. It exists because the inference is not enough: a phone that never runs <code>curl</code> is invisible to it, and this machine's IPv6 address rotates daily, which made the same laptop look like a new visitor 13 times on 25 July 2026. The declared list lives in versioned source, not in the database, so every change to it is in the history.</p>

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
  total < 50
    ? `<p><em>The record is still small. Figures on this page are published from the first request onward rather than held back, so the dataset can be watched as it accumulates. Treat early numbers as a record of what happened, not as a finding about crawler behaviour in general.</em></p>`
    : ""
}

<h2>Declared clients</h2>

<p>User-Agent strings are claims, not verified identities. They are recorded verbatim and counted as-is.</p>

${
  agentRows.length === 0
    ? "<p>No clients observed yet.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>User agent (claimed)</th><th>Requests</th><th>First seen</th><th>Last seen</th></tr></thead>
<tbody>${agentRows
        .map(
          (r) =>
            `<tr><td class="mono">${escapeHtml(truncate(r.userAgent))}</td><td>${r.hits}</td><td>${escapeHtml(r.firstAt.slice(0, 10))}</td><td>${escapeHtml(r.lastAt.slice(0, 10))}</td></tr>`
        )
        .join("")}</tbody></table></div>`
}

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
            `<tr><td class="mono">${escapeHtml(r.path)}</td><td class="mono">${escapeHtml(truncate(r.userAgent, 60))}</td><td>${r.hits}</td><td>${escapeHtml(r.lastAt.slice(0, 10))}</td></tr>`
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
          `<tr><td class="mono">${escapeHtml(c.token)}</td><td class="mono">${escapeHtml(c.page)}</td><td>${escapeHtml(c.publishedAt.slice(0, 10))}</td><td>&mdash;</td></tr>`
      )
      .join("")}</tbody></table></div>

<h2>Method</h2>

<p>How these figures are produced, and what would make them wrong, is described in the <a href="/lab/methodology">methodology</a>.</p>
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
