import { page, escapeHtml, instant } from "../layout.js";
import { published, bySlug, withdrawnFindings } from "../findings/engine.js";
import { claimsFor, recheck } from "../findings/verifier.js";
import { articlesFor } from "../constitution.js";

// Renders whatever the store holds. Nothing here is hard-coded: a finding
// produced by a detector five minutes ago and one written by a person in July
// render through the same path, and each says which it is.

const ORIGIN_LABEL = {
  detector: "Detected automatically",
  human: "Written by a person"
};

function originNote(f) {
  if (f.origin === "human") {
    return `<p class="status">Written by a person from the record &middot; ${escapeHtml(instant(f.publishedAt))}</p>`;
  }
  return `<p class="status">Detected automatically by <code>${escapeHtml(f.detectorId)}</code> &middot; ${escapeHtml(instant(f.publishedAt))}</p>`;
}

/**
 * The chain from stored observation to published sentence, with the query that
 * produced each figure and what that query returns right now.
 *
 * Publishing the SQL is the point. A figure whose derivation is described but
 * not shown still has to be taken on trust, and this site's whole argument is
 * that trust is the wrong instrument.
 */
function evidenceChain(finding) {
  const claims = claimsFor(finding.id);
  if (claims.length === 0) return "";

  const live = recheck(finding.id);
  const liveBy = new Map(live.map((r) => [r.label, r]));
  const drifted = live.filter((r) => !r.stillAccurate);

  return `<h2>Evidence chain</h2>

<p>This finding was not written from memory. Each figure below came from a query against the immutable request record, and each query is shown so it can be run again — by us, on this page, or by anyone reconstructing the same instrument.</p>

<div class="scroll"><table>
<thead><tr><th>Stage</th><th>What it produced</th></tr></thead>
<tbody>
<tr><td><strong>1. Reality</strong></td><td>Requests recorded by the server as they arrived, written once and never edited.</td></tr>
<tr><td><strong>2. Evidence</strong></td><td>The rule <code>${escapeHtml(finding.detectorId)}</code> selected the observations that bear on this question and emitted each figure with the means of reproducing it.</td></tr>
<tr><td><strong>3. Statement</strong></td><td>A fixed template turned that evidence into the prose above. No language model was involved and no figure was altered.</td></tr>
<tr><td><strong>4. Verification</strong></td><td>Every figure was recomputed against the record. A single mismatch would have discarded the draft.</td></tr>
<tr><td><strong>5. Publication</strong></td><td>${escapeHtml(instant(finding.publishedAt) || "—")}${finding.origin === "human" ? ", after a person wrote and reviewed it" : finding.detectorId === "ai_agent_arrival" || finding.detectorId === "format_preference" ? ", automatically" : ", after review by a person"}.</td></tr>
</tbody></table></div>

<h3>What was measured</h3>

<p>Each figure is stated first as what it means, which does not depend on how this system happens to store anything today. The query underneath it is implementation — it would be written differently on different storage, and it is shown so the figure can be checked, not because it is part of the claim.</p>

${claims
  .map((c) => {
    const now = liveBy.get(c.label);
    const changed = now && !now.stillAccurate;
    return `<div class="qa">
<p class="status">Evidence</p>
<p><strong>${escapeHtml(c.label)}</strong></p>
<p>At publication: <strong>${escapeHtml(c.expected)}</strong>${
      now
        ? changed
          ? ` &middot; recomputed now: <strong>${escapeHtml(now.observedNow ?? "—")}</strong> <span class="status">window still open</span>`
          : ` &middot; recomputed now: <strong>${escapeHtml(now.observedNow ?? "—")}</strong> <span class="status">unchanged</span>`
        : ""
    }</p>
<p class="status">Implementation — how this is computed on today's storage</p>
<pre><code>${escapeHtml(c.sql.trim())}</code></pre>
</div>`;
  })
  .join("\n")}

${
  drifted.length
    ? `<p><strong>${drifted.length} figure${drifted.length === 1 ? " has" : "s have"} moved since publication.</strong> That is expected where a window is still open: the record grew, so the count grew. It means the sentence has aged, not that it was wrong. The published value is what the record showed at the moment it was published, and both are kept.</p>`
    : `<p>Every figure still returns what it returned at publication.</p>`
}`;
}

/** Which rules the finding was held to. */
function governedBy(detectorId) {
  const articles = articlesFor(detectorId);
  if (articles.length === 0) return "";
  return `<h2>Governed by</h2>
<ul>
${articles
  .map(
    (a) =>
      `<li><a href="/constitution#${escapeHtml(a.slug)}"><strong>${escapeHtml(a.id)}.</strong> ${escapeHtml(a.title)}</a> — ${escapeHtml(a.short)}</li>`
  )
  .join("\n")}
</ul>
<p>These are the standards this finding was held to, not a claim that it is beyond question. The <a href="/constitution">constitution</a> states them in full.</p>`;
}

function truncate(value, max = 42) {
  const t = String(value ?? "");
  return t.length > max ? `${t.slice(0, max)}\u2026` : t;
}

export function findingsIndex(canary, publishedAt) {
  const all = published();
  const auto = all.filter((f) => f.origin === "detector").length;
  const withdrawn = withdrawnFindings();
  const liveThenRemoved = withdrawn.filter((f) => f.publishedAt).length;

  return page({
    title: "Findings",
    description:
      "Dated records of what this observatory has established about AI agent and crawler behaviour, each with its evidence and its limits.",
    path: "/findings",
    canary,
    published: publishedAt,
    body: `
<h1>Findings</h1>

<p class="lede">What the record has established, dated and frozen. Each entry states what was observed, what it means, and the limits that stop it meaning more.</p>

<p>${all.length} published${auto > 0 ? `, of which ${auto} ${auto === 1 ? "was" : "were"} detected and written automatically` : ""}. Live counters are on the <a href="/lab">lab page</a>; this is the archive of what has been concluded from them.</p>

${
  all.length === 0
    ? "<p>Nothing has been established yet.</p>"
    : all
        // Titles only. The summaries used to sit here too, and then the weekly
        // report started carrying them so a week would say what was learned
        // rather than list what was filed — which put the same paragraph on two
        // pages a reader walks through in order.
        //
        // The index is the one that gives them up, because the house style makes
        // it cheap: a headline here is already a sentence with the figures in it
        // — "One address requested 34 distinct paths within 3 seconds" — so a
        // reader scanning the archive loses nothing but the second copy.
        .map(
          (f) => `<div class="qa">
${originNote(f)}
<h3><a href="/findings/${escapeHtml(f.slug)}">${escapeHtml(f.title)}</a></h3>
</div>`
        )
        .join("\n")
}

<h2>Withdrawn and rejected</h2>

<p>${withdrawn.length} conclusion${withdrawn.length === 1 ? "" : "s"} that this pipeline drew and then stopped publishing. ${liveThenRemoved} of them ${liveThenRemoved === 1 ? "was" : "were"} live on this site before being taken down, which is the reason this table exists: a page that returned 200 and now returns 404 owes an explanation to whoever read it.</p>

<p><strong>What is listed is the subject and the reason. The withdrawn text is not republished.</strong> Most of these findings named a company as a visitor to this site and were wrong about it; reprinting that sentence under a "rejected" heading would put the false claim back on an indexable page, where a crawler reads the sentence and not the label. That would repeat the mistake in order to disclose it.</p>

${
  withdrawn.length === 0
    ? "<p>Nothing has been withdrawn.</p>"
    : `<div class="scroll"><table>
<thead><tr><th>Subject</th><th>Was published</th><th>Taken down</th><th>Why it is not published</th></tr></thead>
<tbody>${withdrawn
        .map(
          (f) =>
            `<tr><td class="mono">${escapeHtml(truncate(f.subjectKey ?? "—", 42))}</td><td>${escapeHtml(instant(f.publishedAt) || "never live")}</td><td>${escapeHtml(instant(f.rejectedAt) || "not recorded")}</td><td>${escapeHtml(f.rejectedReason ?? "—")}</td></tr>`
        )
        .join("")}</tbody></table></div>

<p>Where the takedown column says <em>not recorded</em>, the instant genuinely is not known: the column that holds it was added on 2026-07-27, after these were withdrawn, and it was not backfilled. Writing today's date into those rows would have invented a fact to fill a gap.</p>`
}

<h2>How a finding gets published</h2>

<p>Rules run continuously over the stored observations. When one matches, it produces a candidate carrying the exact figures that support it, each paired with the query that produced it. A template turns the candidate into prose without touching the figures. A verifier then recomputes every figure against the record, and a single mismatch discards the draft entirely.</p>

<p>Findings that restate a count publish themselves once verified. Findings that say something unflattering about a named actor — a compliance failure, a contradicted identity — wait for a person to read them first, because a wrong one there would cost more than a missing one.</p>

<h2>Standard applied</h2>

<p>A finding is published when the record supports a specific statement, not when it supports a general one. Under the <a href="/constitution">constitution</a>, every figure must be recomputable from stored observations, sample size must be stated, and absence of evidence is reported as absence of evidence. A finding of <em>n</em> = 1 is published as a finding of <em>n</em> = 1.</p>
`
  });
}

export function findingPage(slug, canary, publishedAt) {
  const f = bySlug(slug);
  if (!f) return null;

  const others = published()
    .filter((o) => o.slug !== slug)
    .slice(0, 5);

  return page({
    title: f.title,
    description: f.summary.slice(0, 300),
    path: `/findings/${slug}`,
    canary,
    // The full instant, not the date. This value reaches two places that both
    // need it: the marker line, whose timestamp is the zero point of the
    // time-to-ingestion measurement, and schema.org's datePublished, which
    // accepts a full ISO 8601 moment and is read by machines.
    published: f.publishedAt,
    schemaType: "Article",
    mainEntity: {
      "@type": "Article",
      headline: f.title,
      datePublished: f.publishedAt,
      abstract: f.summary,
      author: {
        "@type": "Organization",
        name: "AgentShield Observatory"
      },
      creativeWorkStatus: ORIGIN_LABEL[f.origin] ?? f.origin
    },
    body: `
${originNote(f)}

<h1>${escapeHtml(f.title)}</h1>

<p class="lede">${escapeHtml(f.summary)}</p>

${f.bodyHtml}

${evidenceChain(f)}

${governedBy(f.detectorId)}

${
  others.length
    ? `<h2>Other findings</h2>
<ul>
${others.map((o) => `<li><a href="/findings/${escapeHtml(o.slug)}">${escapeHtml(o.title)}</a></li>`).join("\n")}
</ul>`
    : ""
}

<p><a href="/findings">All findings</a> &middot; <a href="/lab">Live record</a> &middot; <a href="/lab/methodology">Methodology</a></p>
`
  });
}

/** Slugs for the sitemap and canary surfaces. */
export function findingSlugs() {
  return published().map((f) => f.slug);
}

export function findingVariant(slug) {
  return bySlug(slug) ? `finding_${slug.replace(/-/g, "_")}` : null;
}
