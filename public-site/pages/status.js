import { page, escapeHtml, instant } from "../layout.js";
import { paths, summarise } from "../self/changes.js";
import { readiness } from "../readiness.js";
import { epistemicIntegrity } from "../integrity.js";
import { health } from "../console/queries.js";
import { headline } from "../stats.js";
import { ENGINE_VERSION, published, pending } from "../findings/engine.js";
import db from "../realityDb.js";

// The public half of the operator console.
//
// The console itself binds to loopback and stays there. It carries the approve
// button, and it prints the address of every client that has ever arrived —
// putting either on the public interface would hand a stranger the power to
// publish, and would break the promise the methodology makes to visitors about
// what gets reported about them.
//
// What is safe to publish is the part that is about the instrument rather than
// about anyone who visited it: whether it is still recording, whether it still
// obeys its own rules, and what is waiting in the queue. Those checks run
// against the record at the moment this page is served — a stale copy of a
// self-check is worth nothing, because the only interesting moment is the one
// where it stops holding.
const rejectedCount = db.prepare(
  "SELECT COUNT(*) AS n FROM Finding WHERE status = 'rejected'"
);

function verdict(ok) {
  return ok
    ? '<span class="status" style="color:var(--ok)">holding</span>'
    : '<span class="status" style="color:#c0392b">BROKEN</span>';
}

/**
 * Which questions this instrument may yet answer.
 *
 * A component being finished and a component having seen enough are different
 * facts, and a page that shows only the first invites everybody — including
 * whoever built it — to forget the second. That is where a measurement system
 * does its lying: not by reporting a wrong figure, but by reporting a real one
 * from a sample that cannot carry it.
 *
 * Each row states what it needs before it may be answered, in code, where it can
 * be argued with. A threshold held in somebody's judgement moves quietly at the
 * moment an answer is wanted.
 */
function whatItCanAnswer() {
  const rows = readiness();
  const ready = rows.filter((r) => r.answerable).length;

  const label = {
    "not built": "no code yet",
    "nothing observed": "built, nothing seen",
    observing: "observing",
    answerable: "answerable"
  };

  return `<h2>What this instrument can answer today</h2>

<p>Everything below is built or is being built. That is not the same as any of it having observed enough to be worth saying, and the two are shown apart because they are usually confused. ${ready} of ${rows.length} questions have a record behind them that carries an answer.</p>

<div class="scroll"><table>
<thead><tr><th>Question</th><th>Needs</th><th>Record holds</th><th>State</th></tr></thead>
<tbody>${rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.question)}</td><td>${escapeHtml(r.needs)}</td><td class="mono">${escapeHtml(
          `${r.observed} ${r.unit}`
        )}</td><td>${r.answerable ? "<strong>answerable</strong>" : escapeHtml(label[r.state])}</td></tr>`
    )
    .join("")}</tbody></table></div>

<p>The thresholds are not statistical power calculations. They are the point below which a sentence would be plainly indefensible — one crawler seen on three separate days before its reading order is called a habit, three complete weeks before a direction is called a trend. They are published so that a figure crossing one can be checked against the rule rather than against a decision made afterwards.</p>

<p>A row can hold enough observations and still have no code behind it, which is why the last two columns are separate. The reverse is more common and more dangerous: finished code, nothing seen, and a page that shows a tick.</p>`;
}

/**
 * Every change the sensor has seen, and what moved in it.
 *
 * "Something changed" stops being useful the moment more than one file is
 * watched. This site's own sitemap rewrites one `<lastmod>` line every midnight,
 * and a log that cannot separate that from a rewritten rule is a log that gets
 * ignored within a week — so what arrived and what left is printed beside the
 * timestamp.
 */
function changeLog(rows) {
  const all = rows
    .flatMap((r) => [...r.originChanges, ...r.edgeChanges])
    .sort((a, b) => (a.to.at < b.to.at ? 1 : -1))
    .slice(0, 12);

  if (all.length === 0)
    return `<p>No watched file has changed since the sensor started. Nothing is
concluded from that yet — the record is short, and a file that has not changed in
a few hours has not been shown to be stable.</p>`;

  const lines = (list, sign) =>
    list
      .slice(0, 6)
      .map((l) => `${sign} ${escapeHtml(l)}`)
      .join("\n");

  return `<div class="scroll"><table>
<thead><tr><th>Observed</th><th>Path</th><th>Seen from</th><th>What moved</th></tr></thead>
<tbody>${all
    .map(
      (c) => `<tr><td>${escapeHtml(instant(c.to.at))}</td><td class="mono">${escapeHtml(
        c.path
      )}</td><td>${escapeHtml(c.vantage)}</td><td>${
        c.diff.reorderedOnly
          ? "<em>no line added or removed — the arrangement changed</em>"
          : `<pre><code>${escapeHtml(
              [lines(c.diff.removed, "−"), lines(c.diff.added, "+")]
                .filter(Boolean)
                .join("\n")
            )}</code></pre>`
      }</td></tr>`
    )
    .join("")}</tbody></table></div>

<p>A rule line arrives in that column without the <code>User-agent</code> group it
belonged to, so it says that something in the rules moved and not which client is
affected. Both bodies are kept verbatim, which is what makes reading them possible.</p>`;
}

/**
 * What a stranger receives, next to what this server sent.
 *
 * The section exists because this site could not answer that question about
 * itself. Its own robots.txt was served with nine crawler groups and
 * `Disallow: /` prepended for an unknown length of time, and "unknown" was the
 * honest word: nothing here had ever looked at the outside of this site, so the
 * record could say what the origin holds today and nothing about what anyone
 * was given yesterday.
 */
function selfObservation() {
  const watched = paths();
  if (watched.length === 0)
    return `<h2>What the outside receives</h2>
<p>The sensor is installed and has not completed a sweep yet. Nothing is claimed
about what the edge is serving until something has been observed.</p>`;

  const rows = watched.map((p) => summarise(p));
  const anyDiverged = rows.some((r) => r.divergedSweeps > 0);

  return `<h2>What the outside receives ${verdict(!anyDiverged)}</h2>

<p>Every hour this site fetches its own files twice: once over the loopback address, bypassing the network in front of it, and once over the public hostname, through it. Both are real requests to this same process, so anything the response path adds on the way out appears in both and cancels — what remains in the difference belongs to the network.</p>

<p>This is here because the question was once unanswerable. For an unknown period the edge served a <code>robots.txt</code> telling eight AI crawlers to stay away, over an origin file that welcomes them by name, and <a href="/cdn-interventions">the record could not date the start of it</a>. An hourly snapshot cannot recover that. It can stop the next one from being undatable.</p>

<div class="scroll"><table>
<thead><tr><th>Path</th><th>Sweeps</th><th>Edge differed from origin</th><th>Origin changed</th><th>Edge changed</th><th>Last seen</th></tr></thead>
<tbody>${rows
    .map(
      (r) =>
        `<tr><td class="mono">${escapeHtml(r.path)}</td><td>${r.comparableSweeps}</td><td>${
          r.divergedSweeps > 0 ? `<strong>${r.divergedSweeps}</strong>` : "0"
        }</td><td>${r.originChanges.length}</td><td>${r.edgeChanges.length}</td><td>${escapeHtml(
          instant(r.latestObserved) || "—"
        )}</td></tr>`
    )
    .join("")}</tbody></table></div>

${
  anyDiverged
    ? `<p><strong>The edge is not serving what this server sent.</strong> The difference is recorded with both bodies kept, so what was added or removed can be read rather than inferred.</p>`
    : `<p>Every comparable sweep so far found the two identical. That is a statement about the sweeps taken, not a guarantee about the moments between them: at one snapshot an hour, a change beginning at 14:10 is datable to 15:00 and no closer.</p>`
}

${changeLog(rows)}

<p>Whether a file is regenerated on every request is measured here rather than declared. A page that differs from itself on every sweep is describing itself as dynamic, and a hardcoded list of such pages would be a claim nobody rechecks — stale the first time one of them becomes static.</p>`;
}

export function status(canary, publishedAt) {
  const integrity = epistemicIntegrity();
  const rows = health();
  const s = headline();
  const rejected = rejectedCount.get().n;
  const live = published().length;
  const queued = pending().length;
  const failing = integrity.checks.filter((c) => !c.ok).length;

  return page({
    title: "Status",
    description:
      "The instrument checking itself: whether it is still recording, and whether it still obeys the rules it publishes under. Recomputed when this page is served.",
    path: "/status",
    canary,
    published: publishedAt,
    body: `
<h1>Status</h1>

<p class="lede">Everything below was recomputed from the record at the moment this page was served. It is the instrument reporting on itself, and it is published because a self-check nobody can see is not a check.</p>

<h2>Does it still obey its own rules ${verdict(integrity.ok)}</h2>

<p>The <a href="/constitution">constitution</a> states the rules this site is bound by. Five of them are executable, which is the only kind that survives: <strong>a rule with no check behind it is an intention, not a rule.</strong> Each one queries the live record and can fail.</p>

<div class="scroll"><table>
<thead><tr><th>Check</th><th>Result</th><th>What it looked at</th></tr></thead>
<tbody>${integrity.checks
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.name)}</td><td class="mono">${c.ok ? "pass" : "FAIL"}</td><td>${escapeHtml(c.detail ?? "")}</td></tr>`
      )
      .join("")}</tbody></table></div>

${
  failing === 0
    ? `<p>All ${integrity.checks.length} are holding as of this request. That is the expected state and it is the least informative one — the reason to publish this table is the day it reads differently.</p>`
    : `<p><strong>${failing} check${failing === 1 ? " is" : "s are"} failing.</strong> The failure is printed rather than suppressed, and figures produced under a broken rule should be treated as unsupported until it is repaired.</p>`
}

<h2>Is it still recording</h2>

<p>A measurement instrument that quietly stops is worse than one that was never built, because the gap looks like an absence of traffic instead of an absence of observation. These are liveness checks, and unlike the figures elsewhere on this site they count our own requests too — the question is whether the recorder works, not who arrived.</p>

<div class="scroll"><table>
<thead><tr><th>Component</th><th>State</th><th>Reading</th></tr></thead>
<tbody>${rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td class="mono">${r.ok ? "ok" : "CHECK"}</td><td>${escapeHtml(r.detail ?? "")}</td></tr>`
      )
      .join("")}</tbody></table></div>

${whatItCanAnswer()}

${selfObservation()}

<h2>What the review queue has done</h2>

<p>Nothing on this site publishes itself. A detector proposes a finding, a second mechanism recomputes its central figure by a different route, and a disagreement between them stops publication. Anything that would name an actor waits for a person regardless.</p>

${`<div class="grid">
<div><div class="stat">${live}</div><div class="stat-label">Published</div></div>
<div><div class="stat">${rejected}</div><div class="stat-label">Rejected</div></div>
<div><div class="stat">${queued}</div><div class="stat-label">Waiting for review</div></div>
</div>`}

<p>The middle figure is the one worth reading. ${
      rejected === 0
        ? "Nothing has been rejected yet, which means the gate has not yet been shown to bite."
        : `${rejected} proposed finding${rejected === 1 ? " was" : "s were"} stopped before publication and ${rejected === 1 ? "is" : "are"} kept in the record with the reason. A review gate that has never rejected anything has not been demonstrated to be a gate at all.`
    } Rejected findings are not listed here by name: they failed verification, and publishing an unverified claim about a named client in order to show that it was rejected would be the same mistake it was rejected for.</p>

<h2>Which version produced what is published</h2>

<p>Findings carry the version of the method that made them, so improving a detector does not silently restate old conclusions under a new one. The current method is <code>${escapeHtml(ENGINE_VERSION)}</code>, written as detector/template/verifier.</p>

<p>The same discipline turned on this project's own source code produces the <a href="/audit">architecture audit</a>, which publishes under eight articles of its own and prints the command that reproduces every figure it states.</p>

<h2>What this page deliberately does not show</h2>

<p>There is an operator console behind this. It binds to the loopback interface, it is never routed through the public tunnel, and it is not on this site — for two reasons that are worth stating plainly rather than leaving to be discovered.</p>

<ul>
<li><strong>It can publish.</strong> The console carries the approve and reject controls for the review queue. Exposing it would hand the publish button to anyone who found the URL, and every claim on this site about human review would become false at that moment.</li>
<li><strong>It prints addresses.</strong> The console shows the raw client address and full headers of every request, because operating the instrument sometimes requires that. The <a href="/lab/methodology">methodology</a> promises that published tables report agents, paths and counts and never anything that identifies a person. A public console would break that promise about the very people it is measuring.</li>
</ul>

<p>So the split is not a matter of polish. The console holds what is needed to <em>run</em> the instrument; this page holds what is needed to <em>trust</em> it, and those turn out to be almost disjoint sets. Opening a page on the console also records nothing: the capture hook does not run there, so operating this site never contaminates what it is measuring.</p>

<h2>The record this is checking</h2>

<p>${escapeHtml(s.external.toLocaleString("en-US"))} external requests from ${escapeHtml(String(s.ips))} addresses and ${escapeHtml(String(s.agents))} declared identities, observed since ${escapeHtml(s.since ? s.since.slice(0, 10) : "recently")}. The figures, the tables behind them and what they exclude are on the <a href="/lab">lab page</a>.</p>
`
  });
}
