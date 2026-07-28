import { page, escapeHtml, instant } from "../layout.js";
import { ladder, DISCOVERY_VERSION } from "../discovery.js";

// The page for one question: why does a site not appear in an AI system's
// answers?
//
// It is a ladder rather than a score because the useful answer is a location.
// "Visibility: 42" tells nobody what to do; "crawled, indexed, and the assistant
// resolves your name to somebody else" tells them exactly where the work is —
// and on this site, that is the rung it is stuck on today.
//
// The two halves are kept apart on purpose. The lower rungs are climbed by
// requests that arrived here and can be checked against the record. The upper
// ones happen inside somebody else's system and are known only because that party
// said so, which is a report and not an observation. Presenting them as the same
// kind of fact would be the exact substitution this site exists to refuse.

export function discovery(canary, published) {
  const { rungs, version } = ladder();

  const reached = rungs.filter((r) => r.at);
  const stuck = rungs.find((r) => !r.at);

  const body = `
<h1>Why a site does not appear in an AI system's answers</h1>

<p class="lede">Appearing in what an assistant says is not one event. It is a
sequence, and a site can be doing everything right at four rungs and invisible at
the fifth. This page walks the sequence for this site, from its own record.</p>

<h2>The ladder</h2>

<p>Each rung is either <strong>observed</strong> — established from requests that
arrived at this server — or <strong>reported</strong>, meaning somebody else's
system told us. The difference is not presentation. What happens inside a search
index or a model is not visible from here, and a vendor's account of its own index
is the same class of evidence this site declines when a model describes what it
has read. Reports are recorded with who said them and when; nothing is concluded
from them.</p>

<div class="scroll"><table>
<thead><tr><th></th><th>Rung</th><th>Kind</th><th>When</th><th>What the record or the report says</th></tr></thead>
<tbody>${rungs
    .map(
      (r) =>
        `<tr><td>${r.at ? "&#10003;" : "&mdash;"}</td><td><strong>${escapeHtml(r.rung)}</strong></td><td class="mono">${escapeHtml(r.kind)}</td><td class="mono">${escapeHtml(r.at ? (r.at.length > 10 ? instant(r.at) : r.at) : "not reached")}</td><td>${escapeHtml(r.detail ?? "")}</td></tr>`
    )
    .join("")}</tbody></table></div>

<h2>Where this site stands</h2>

<p>${reached.length} of ${rungs.length} rungs have been reached${
    stuck ? `. The first that has not is <strong>${escapeHtml(stuck.rung.toLowerCase())}</strong>` : ""
  }.</p>

<p><strong>This site is crawled and it is indexed, and an assistant asked about it
by name returns six other projects called AgentShield.</strong> Those facts are
not in conflict and the ladder is why: being fetched by a company's crawler and
being returned by that company's assistant are different rungs, with different
machinery behind them, and nothing carries a site from one to the next
automatically.</p>

<p>That is the useful shape of the answer. A single number — a visibility score —
would compress these into one figure and lose the only part anybody can act on,
which is <em>which rung</em>.</p>

<h2>What each rung would take</h2>

<div class="scroll"><table>
<thead><tr><th>If a site is stuck here</th><th>What the record can tell you</th></tr></thead>
<tbody>
<tr><td>Nothing has reached it</td><td>Whether the name resolves, whether the server answers, and whether anything in front of it is refusing clients. All three are observable from outside and from inside, and the two views can be compared.</td></tr>
<tr><td>Ordinary clients arrive, AI crawlers do not</td><td>Whether the rules file a client actually receives differs from the one the origin sends. <a href="/cdn-interventions">On this site it did</a>, for an unknown length of time, and nothing at the origin could see it.</td></tr>
<tr><td>Crawlers arrive but read nothing</td><td>Which paths they took. <a href="/findings/rules-and-map-never-the-pages">Eight arrivals here read the rules and the map and no page at all</a> — a fact invisible to any counter that reports visits.</td></tr>
<tr><td>Read but not indexed</td><td>Nothing, from here. This is the first rung that lives in somebody else's system, and the honest answer is to say so and go and ask them.</td></tr>
<tr><td>Indexed but not returned</td><td>Nothing, from here — but the question is often not technical. A name shared with better-established projects is answered with those projects, and no amount of crawler work changes it.</td></tr>
<tr><td>Returned but never quoted</td><td>Whether a string published here, existing nowhere else, has appeared in a model's output. This is the one upper rung that is observable rather than reported, because a coined marker does not require anyone to be believed.</td></tr>
</tbody></table></div>

<h2>Limits</h2>

<ul>
<li><strong>One site, four days.</strong> Every date above is this domain's own. Nothing here is a rate, a benchmark, or a claim about how long any rung takes in general.</li>
<li><strong>Reports are one party's word.</strong> Two rungs are recorded because a search console and an assistant said something. Both are recorded verbatim with the date, and neither is evidence.</li>
<li><strong>A rung not reached is not a rung refused.</strong> Nothing above establishes that a system will not return this site, only that it has not been observed doing so.</li>
<li><strong>The last rung has never moved.</strong> It is the one this site exists to move, and it has read zero since the first day.</li>
</ul>

<p class="status">Ladder version ${escapeHtml(version)} &middot; computed when this page was requested</p>
`;

  return page({
    title: "Why a site does not appear in AI answers",
    description:
      "Appearing in an assistant's answer is a sequence of rungs, not one event. This site is crawled, indexed, and still not returned by name — and the ladder shows exactly where that breaks.",
    path: "/discovery",
    canary,
    published,
    schemaType: "Report",
    body
  });
}

export const DISCOVERY_PAGE_VERSION = DISCOVERY_VERSION;
