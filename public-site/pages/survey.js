import { page, escapeHtml, instant } from "../layout.js";
import { POPULATION } from "../survey/population.js";
import { USER_AGENT, MIN_INTERVAL_MS, MAX_CONCURRENT, VANTAGE_POINT } from "../survey/fetch.js";
import { analyse, AI_AGENTS, ANALYSIS_VERSION } from "../survey/analyse.js";

// The page the survey's user agent points at.
//
// Its first reader is not a visitor. It is somebody who found a line in their
// access log and wants to know what fetched their robots.txt, so the page opens
// by answering that and by saying how to stop it — before anything about what
// the survey found. A crawler that explains itself only after presenting its
// results has the order backwards.
//
// Every figure is computed when the page is requested, like the weekly report.
// Before the first run it says the survey has been declared and not conducted,
// which is a true sentence and a better one than an empty table.

const n = (value) => escapeHtml(Number(value ?? 0).toLocaleString("en-US"));

function terms() {
  return `<div class="scroll"><table>
<thead><tr><th>Declared before the first request</th><th></th></tr></thead>
<tbody>
<tr><td>Population</td><td><a href="${escapeHtml(POPULATION.url)}">${escapeHtml(POPULATION.id)}</a>, a ranking with a permanent identifier</td></tr>
<tr><td>Sample</td><td>${escapeHtml(POPULATION.rule)}</td></tr>
<tr><td>Size</td><td>${n(POPULATION.size)} domains, drawn ${escapeHtml(POPULATION.drawnAt)}</td></tr>
<tr><td>Requested</td><td>Only <code>/robots.txt</code>, once per domain per run</td></tr>
<tr><td>User agent</td><td><code>${escapeHtml(USER_AGENT)}</code></td></tr>
<tr><td>Rate</td><td>${n(MIN_INTERVAL_MS)} ms between requests, at most ${n(MAX_CONCURRENT)} in flight</td></tr>
<tr><td>Conducted from</td><td>${escapeHtml(VANTAGE_POINT)}</td></tr>
</tbody></table></div>`;
}

function results(r) {
  if (!r || r.attempted === 0)
    return `<p>The survey has been declared and not yet conducted. The terms above were
written down first on purpose: a method chosen after its results are visible is not
a method, and this page exists partly so that the description cannot be adjusted
later to fit what was found.</p>`;

  const reached = r.answered;
  const share = (part) =>
    r.servedRobots > 0 ? `${Math.round((part / r.servedRobots) * 1000) / 10}%` : "—";

  return `<div class="grid">
<div><div class="stat">${n(r.attempted)}</div><div class="stat-label">Domains asked</div></div>
<div><div class="stat">${n(r.servedRobots)}</div><div class="stat-label">Served a robots.txt</div></div>
<div><div class="stat">${n(r.managedBlock)}</div><div class="stat-label">Carried an injected block</div></div>
<div><div class="stat">${n(r.contradicted)}</div><div class="stat-label">Where it contradicts the owner</div></div>
</div>

<p>Of ${n(r.attempted)} domains, ${n(reached)} answered and ${n(r.unreachable)} did not.
${n(r.servedRobots)} of the answers were a robots.txt; ${n(r.noRobots)} were something
else, usually an HTML error page returned with status 200.</p>

<p><strong>${n(r.managedBlock)} of the ${n(r.servedRobots)} files (${share(r.managedBlock)})
contained a block a CDN had inserted</strong>, identified by the boundary comment the CDN
writes around its own additions. ${n(r.managedBlocksAnAiAgent)} of those blocks close the
site to at least one of the ${n(AI_AGENTS.length)} AI crawlers this survey asks about.</p>

<p><strong>${n(r.contradicted)} of them contradict the site's own file</strong> — the
inserted block refuses a crawler that the owner's own section names and allows. That is
the number this survey was built for. It is not an estimate of how many owners are
unaware; nobody outside those organisations can measure intent, and a file that
contradicts itself is evidence of a contradiction and nothing more.</p>

<p>Separately, ${n(r.ownerBlocksAnAiAgent)} sites close the door to an AI crawler in their
own text, with no CDN involved. Those are decisions, and they are counted apart from the
injections for exactly that reason.</p>

${
  r.agents.some((a) => a.managedBlocked > 0)
    ? `<h2>Which crawlers, and what the owner said about the same name</h2>

<div class="scroll"><table>
<thead><tr><th>Crawler</th><th>Refused by the inserted block</th><th>Owner allows it</th><th>Owner also refuses it</th><th>Owner never mentions it</th></tr></thead>
<tbody>${r.agents
        .filter((a) => a.managedBlocked > 0)
        .sort((a, b) => b.managedBlocked - a.managedBlocked)
        .map(
          (a) =>
            `<tr><td><code>${escapeHtml(a.agent)}</code></td><td>${n(a.managedBlocked)}</td><td><strong>${n(a.ownerAllowed)}</strong></td><td>${n(a.ownerBlocked)}</td><td>${n(a.ownerUnmentioned)}</td></tr>`
        )
        .join("")}</tbody></table></div>

<p>The third column is the contradiction. The fifth is not: a site that never mentioned a
crawler has not been overruled, it has been answered for. Both are worth counting and
they are different things.</p>`
    : ""
}

${
  r.errorCodes.length
    ? `<h2>Domains that did not answer</h2>

<div class="scroll"><table>
<thead><tr><th>What stopped the request</th><th>Domains</th></tr></thead>
<tbody>${r.errorCodes
        .map((e) => `<tr><td class="mono">${escapeHtml(e.code)}</td><td>${n(e.count)}</td></tr>`)
        .join("")}</tbody></table></div>

<p>These are the runtime's own error codes, kept verbatim rather than sorted into
categories. Some of them are not about the domain at all — see the limits below.</p>`
    : ""
}`;
}

export function survey(canary, published) {
  const r = analyse();

  const body = `
<h1>The robots.txt survey</h1>

<p class="lede">This site reads other sites' <code>robots.txt</code> to count how often a
content delivery network has written something into it that the owner did not write.</p>

<h2>If you found this in your logs</h2>

<p>A request from <code>${escapeHtml(USER_AGENT)}</code> fetched <code>/robots.txt</code>
from your domain and nothing else. One request, no other path, no cookies, no scripts, no
second visit within a run. The file was stored as it was served and is used only to count
— <strong>no domain is ever named in anything published here</strong>, including yours.</p>

<p>To be excluded, refuse the agent in the file itself:</p>

<pre><code>User-agent: AgentShieldObservatory
Disallow: /</code></pre>

<p>That is read before the next run and honoured. There is an obvious circularity in
asking a survey about robots.txt compliance to prove its own by obeying robots.txt, and
the only answer to it is that the fetches are recorded here and can be checked against
what this page claims.</p>

<h2>Why</h2>

<p>On 27 July 2026 this site discovered that its own <code>robots.txt</code> was being
served with nine crawler groups and <code>Disallow: /</code> prepended to it by the CDN
in front of it. The file at the origin welcomed those crawlers by name. For an unknown
period, the site had been telling the crawlers it exists to observe not to come, in a
voice that was not its own, and <a href="/cdn-interventions">nothing at the origin could
see it</a>.</p>

<p>The obvious next question is how many other sites are in that position. It is
answerable because the intervention signs itself: the CDN writes a boundary comment
around what it adds, so separating the inserted part from the owner's part needs no
guess about what the origin "probably" served.</p>

${terms()}

<h2>What the record shows</h2>

${results(r)}

<h2>Limits</h2>

<p><strong>Reachability was measured from one place.</strong> Of the first eight domains
ever fetched, two answered with a connection reset and failed to resolve in DNS — the
signature of network filtering between here and them, not of those sites being down.
Nothing in the instrument can tell the two apart, so the vantage point is recorded with
every run and a domain that did not answer is never counted as a domain without a
robots.txt.</p>

<p><strong>A wildcard is not an answer about a named crawler.</strong> A site whose file
says <code>User-agent: *</code> has not decided anything about GPTBot, so it is counted as
not having mentioned it. Reading a wildcard as a decision would report sites as having
closed a door they never considered.</p>

<p><strong>Only a bare <code>Disallow: /</code> counts as closed.</strong> Narrower rules
are real and are not a closed door. Counting them would inflate every figure on this
page.</p>

<p><strong>An intervention that does not announce itself is invisible here.</strong> This
survey finds one CDN's managed block because that CDN labels it. A rewrite with no marker
would be counted as the owner's own text, and this page would have no way of knowing.</p>

<p><strong>Nobody's intent is measured.</strong> A file that contradicts itself is
evidence of a contradiction. Whether the owner knows, chose it, or would change it is
outside what a fetched file can show, and the numbers above say nothing about it.</p>

<p class="status">Population ${escapeHtml(POPULATION.id)} &middot; sample drawn
${escapeHtml(POPULATION.drawnAt)} &middot; analysis ${escapeHtml(ANALYSIS_VERSION)}${
    r?.survey?.finishedAt ? ` &middot; last run completed ${escapeHtml(instant(r.survey.finishedAt))}` : ""
  }</p>
`;

  return page({
    title: "The robots.txt survey",
    description:
      "Counting how often a CDN has written a rule into a site's robots.txt that the site's owner did not write, across a declared sample of 400 domains.",
    path: "/survey",
    canary,
    published,
    schemaType: "Report",
    body
  });
}
