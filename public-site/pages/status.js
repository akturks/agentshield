import { page, escapeHtml } from "../layout.js";
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
