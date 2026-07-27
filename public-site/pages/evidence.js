import { escapeHtml } from "../layout.js";
import db from "../realityDb.js";
import { EXTERNAL, notOperator } from "../stats.js";
import { declaredIdentities } from "../identities.js";

// What the record can say about each question, today.
//
// The question pages were written before there was anything to answer them with,
// so most of them describe an instrument and end with "live counts are on the lab
// page". That is a page telling a reader to go and do the work themselves, and it
// is also the shape that never improves: the prose stays identical whether the
// record holds eleven requests or eleven million.
//
// These blocks close that gap. Each one is a query, rendered under the same
// heading on whichever question it belongs to, carrying the date it was computed.
// A year of accumulation makes those answers heavier without anybody editing a
// sentence, which is the only kind of content that compounds on a site nobody has
// time to maintain.
//
// The honesty rule from questions.js applies harder here, not less: a block that
// has nothing to report says so. "No external client has ever executed the script
// on this site" is a finding. Silence dressed as an answer is not.

function block(inner) {
  return `<h2>What the record shows today</h2>\n${inner}`;
}

function table(head, rows) {
  if (rows.length === 0) return "";
  return `<div class="scroll"><table>
<thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const tooThin = (n, what) =>
  `<p><em>${escapeHtml(String(n))} ${escapeHtml(
    what
  )} is not enough to publish a rate. This is a record of what happened, not a finding about crawler behaviour in general.</em></p>`;

// ── robots.txt compliance ────────────────────────────────────────────────────

const disallowedByAgent = db.prepare(`
  SELECT userAgent, COUNT(*) AS hits, COUNT(DISTINCT path) AS paths
  FROM RequestReality
  WHERE ${EXTERNAL}
    AND (path LIKE '/internal/%' OR path LIKE '/no-crawl/%' OR path LIKE '/private-preview/%')
  GROUP BY userAgent ORDER BY hits DESC LIMIT 15
`);

const robotsReaders = db.prepare(
  `SELECT COUNT(DISTINCT userAgent) AS n FROM RequestReality WHERE ${EXTERNAL} AND path = '/robots.txt'`
);

export function robotsCompliance() {
  const rows = disallowedByAgent.all();
  const readers = robotsReaders.get().n;
  const total = rows.reduce((sum, r) => sum + r.hits, 0);

  if (total === 0)
    return block(
      `<p><strong>No external client has fetched a disallowed path.</strong> ${escapeHtml(
        String(readers)
      )} distinct user agents have requested <a href="/robots.txt">robots.txt</a>, so the rules
      have been read; nothing has yet been observed ignoring them.</p>
      <p>That is not the same as "AI crawlers respect robots.txt". It is one small domain over a
      short period, and a client that never requested the rules cannot be said to have honoured
      them. The figure that would answer the question is a rate, and the sample cannot support
      one.</p>`
    );

  return block(
    `<p>${escapeHtml(String(total))} fetches of disallowed paths, from
    ${escapeHtml(String(rows.length))} distinct declared identities.
    ${escapeHtml(String(readers))} distinct user agents have requested robots.txt.</p>
    ${table(
      ["User agent (claimed)", "Fetches", "Disallowed paths"],
      rows.map((r) => [
        `<span class="mono">${escapeHtml(r.userAgent ?? "—")}</span>`,
        r.hits,
        r.paths
      ])
    )}
    <p>A fetch proves the fetch happened. It does not prove the client read the rules and chose
    to disregard them — it may never have requested the file.</p>
    ${total < 25 ? tooThin(total, "fetches") : ""}`
  );
}

// ── JavaScript execution ─────────────────────────────────────────────────────

const jsRows = db.prepare(`
  SELECT r.userAgent, COUNT(*) AS n
  FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
  WHERE r.cfRay IS NOT NULL AND ${notOperator("r")}
  GROUP BY r.userAgent ORDER BY n DESC LIMIT 15
`);

const probeViews = db.prepare(
  `SELECT COUNT(*) AS n FROM RequestReality WHERE ${EXTERNAL} AND routeVariant = 'probe_js'`
);

export function javascriptExecution() {
  const rows = jsRows.all();
  const views = probeViews.get().n;

  if (rows.length === 0)
    return block(
      `<p><strong>No external client has ever executed the script on this site.</strong>
      The probe page has been fetched ${escapeHtml(String(views))} times from outside; the beacon
      it contains has never fired for any of them.</p>
      <p>This is a real result rather than a missing measurement — the mechanism works and has
      been verified with a browser. It means every external client that has fetched that page so
      far read the HTML and stopped there, which is what a crawler that does not render pages
      looks like.</p>`
    );

  return block(
    `<p>The probe page has been fetched ${escapeHtml(String(views))} times from outside, and the
    beacon fired for the clients below.</p>
    ${table(
      ["User agent (claimed)", "Executions"],
      rows.map((r) => [`<span class="mono">${escapeHtml(r.userAgent ?? "—")}</span>`, r.n])
    )}`
  );
}

// ── time to ingestion ────────────────────────────────────────────────────────

// Queried directly rather than through canary.js, which imports the question
// slugs — routing this through it would close a cycle back into the page that
// renders these blocks.
const markerSpan = db.prepare(
  `SELECT COUNT(*) AS n, MIN(publishedAt) AS oldest FROM CanaryToken WHERE retiredAt IS NULL`
);

export function ingestion() {
  const { n: count, oldest } = markerSpan.get();
  const days = oldest ? Math.floor((Date.now() - Date.parse(oldest)) / 86400000) : 0;

  return block(
    `<p><strong>${escapeHtml(String(count))} markers published.
    ${escapeHtml(String(0))} observed in a language model's output.</strong>
    The oldest has been live for ${escapeHtml(String(days))} day${days === 1 ? "" : "s"}.</p>
    <p>So this question has no answer here yet, and the honest form of that is a number rather
    than a paragraph. Until one marker appears, the only thing established is a lower bound: for
    the pages published so far, ingestion has not been observed within ${escapeHtml(
      String(days)
    )} days.</p>
    <p>A lower bound is not a finding about how long ingestion takes. It is the measurement
    running, in public, with nothing to report — which is the state most measurements are in most
    of the time.</p>`
  );
}

// ── who is actually who ──────────────────────────────────────────────────────

export function declaredVsCorroborated() {
  const ids = declaredIdentities();

  if (ids.requests === 0)
    return block(
      `<p>No client has yet declared one of the AI crawler identities this site checks for.</p>`
    );

  return block(
    `<p>${escapeHtml(String(ids.requests))} external requests have declared one of these
    identities. Checked against the address ranges each vendor publishes for its own crawler:</p>
    ${table(
      ["Outcome", "Requests", "What it means"],
      [
        [
          "<strong>Corroborated</strong>",
          ids.verified,
          "came from inside the vendor's published range"
        ],
        [
          "Vendor's other range",
          ids.vendor_other,
          "a different range belonging to the same vendor"
        ],
        [
          "<strong>Contradicted</strong>",
          ids.unlisted,
          "the vendor publishes a list and this address is not on it"
        ],
        [
          "Uncheckable",
          ids.unverifiable,
          "no machine-readable list exists to check against"
        ]
      ]
    )}
    <p>Only <em>contradicted</em> is evidence against a client, and it means the declaration is
    uncorroborated — never intent. <em>Uncheckable</em> is a gap in a vendor's publishing:
    Anthropic and Common Crawl publish nothing verifiable, so every one of their agents lands
    there however genuine it is. Snapshot captured ${escapeHtml(ids.snapshot ?? "—")}.
    <a href="/lab#checked">The per-agent split</a>.</p>`
  );
}

// ── format preference ────────────────────────────────────────────────────────

const formats = db.prepare(`
  SELECT routeVariant, COUNT(*) AS hits, COUNT(DISTINCT userAgent) AS agents
  FROM RequestReality
  WHERE ${EXTERNAL} AND routeVariant LIKE 'probe_%'
  GROUP BY routeVariant ORDER BY hits DESC
`);

const LABEL = {
  probe_html: "HTML",
  probe_js: "HTML requiring JavaScript",
  probe_noscript: "HTML with a noscript fallback",
  probe_data_json: "JSON",
  probe_data_md: "Markdown",
  probe_data_txt: "Plain text"
};

export function formatPreference() {
  const rows = formats.all();
  const total = rows.reduce((sum, r) => sum + r.hits, 0);

  if (total === 0)
    return block(`<p>No probe variant has been fetched from outside yet.</p>`);

  return block(
    `<p>The same content is published in six shapes at six addresses, all listed in
    <a href="/sitemap.xml">the sitemap</a> and none preferred by any link. Fetches so far:</p>
    ${table(
      ["Format", "Fetches", "Distinct agents"],
      rows.map((r) => [
        escapeHtml(LABEL[r.routeVariant] ?? r.routeVariant),
        r.hits,
        r.agents
      ])
    )}
    <p>Reach is not equal between them — the sitemap lists all six, but nothing else on the site
    links them evenly, so a difference here may be a difference in discovery rather than in
    preference.</p>
    ${total < 50 ? tooThin(total, "fetches") : ""}`
  );
}

/** Which block belongs to which question. Absent means the page keeps its prose. */
export const EVIDENCE = {
  "do-ai-crawlers-respect-robots-txt": robotsCompliance,
  "which-ai-crawlers-execute-javascript": javascriptExecution,
  "how-long-until-published-text-reaches-a-model": ingestion,
  "how-to-tell-if-an-ai-read-your-site": ingestion,
  "what-are-gptbot-claudebot-perplexitybot": declaredVsCorroborated,
  "should-you-block-ai-crawlers": declaredVsCorroborated,
  "which-content-format-do-ai-crawlers-prefer": formatPreference
};
