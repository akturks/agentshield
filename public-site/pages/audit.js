import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { page } from "../layout.js";
import { renderMarkdown } from "../markdown.js";

const here = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(here, "..", "..", "docs", "self-audit.md");

// The second stream on this site, and deliberately not mixed into the first.
//
// The observatory measures how AI systems read the web, and the people who arrive
// for it are interested in crawlers. This page is about something else — whether a
// codebase still does what its documentation says — and the audience is a different
// one. Merging the two would produce a site that reads as one subject to nobody.
//
// The report is read from a file in the repository rather than rendered from the
// scan database. The database is regenerable and local; the file is committed, so
// what was found and when is in the history of one artefact that anyone can check
// out. That is the same claim this tool makes about code, applied to its own output.

function reportMarkdown() {
  try {
    return readFileSync(REPORT_PATH, "utf8");
  } catch {
    return null;
  }
}

export function audit(canary, published) {
  const markdown = reportMarkdown();

  const body = `
<h1>Architecture verification</h1>

<p class="lede">A codebase and its documentation drift apart quietly. This finds
where they have, says when it started, and gives you the command that proves it.</p>

<p>Documentation describes intent. Code is what runs. The gap between them opens one
commit at a time and is invisible until somebody trusts the wrong document — and by
then nobody remembers which change opened it.</p>

<p>What is on this page is the output of running that check against
<strong>this</strong> repository. Not a sample, not a demonstration written to look
convincing: the real findings, including the ones that are unflattering, and the
history of the corrections that produced them.</p>

<h2>How it works</h2>

<p>Three steps, and the second one is the one that matters.</p>

<ul>
<li><strong>Read the repository.</strong> What is in it, recorded as observed fact at
a named commit. No judgement is stored beside an observation, so any conclusion can
be re-derived later from the same rows.</li>
<li><strong>Check every figure twice, by different machinery.</strong> A finding is
drafted from the scan, then each of its numbers is recomputed by a separate route
before publication. When the two disagree the finding is refused rather than
published. That has already happened here, and the disagreement was real.</li>
<li><strong>Date it.</strong> Every finding carries the commit where the divergence
began, its message, and how long it has stood.</li>
</ul>

<p>Nothing publishes itself. A person reads each finding before it appears, because
the counts cannot settle whether a repetition was deliberate.</p>

<h2>What it does not do</h2>

<p>The limits are here rather than in a footnote, because a reader who discovers
them later is right to discount everything above.</p>

<ul>
<li><strong>No recommendation.</strong> This says what is in the repository and when
it got there. What to do about it is a judgement that needs context this has no
access to — and a confident wrong recommendation costs more than no recommendation.</li>
<li><strong>No reachability analysis.</strong> A duplicated value in code nothing
calls is a different problem, and this cannot tell the two apart. It says so on
every finding. Naive import analysis is worse than nothing here: this codebase
passes its collaborators as arguments, so an import graph reports most of its
services as dead.</li>
<li><strong>No syntax tree.</strong> The scan reads text with comments and string
literals removed. A threshold assembled by arithmetic, or held in a variable and
compared elsewhere, is invisible to it.</li>
<li><strong>No score.</strong> There is no grade, no health percentage and no
ranking. A number summarising a codebase is a judgement wearing a measurement's
clothes.</li>
</ul>

<h2>Correct and few, over many and doubtful</h2>

<p>The first run of this detector produced five findings. Three of them were the same
structural fact reported three times, so the grouping changed and five became two.
A summary claimed the duplicated sites had "moved independently since", which nothing
had checked — that sentence is now either verified against the commit history or
absent. One figure disagreed with its own verification and the finding was refused
until the disagreement was understood.</p>

<p>None of that came from designing the tool. All of it came from reading the output
and trying to defend each line of it. A report of twenty findings where three are
wrong is worth less than a report of two that hold, because the reader who finds the
first false one stops reading.</p>

<div class="marker">
<p><strong>Türkçe:</strong> yöntemin açıklaması —
<a href="https://github.com/akturks/agentshield/blob/main/docs/denetim-kilavuzu.md">denetim
kılavuzu</a>. Her bulgunun ne dediği, ne demediği, ve rakamlara neden
güvenilebileceği. Rapor tek dilde üretiliyor; kılavuz onu tekrarlamaz, yöntemi
anlatır.</p>
</div>

<hr>

${
  markdown
    ? renderMarkdown(markdown)
    : `<h2>Report</h2>
<p>The report file is not present in this deployment. It is generated by
<code>pnpm run arch report --write docs/self-audit.md</code> and committed to the
repository; this page renders that file and does not compute anything itself.</p>`
}
`;

  return page({
    title: "Architecture verification",
    description:
      "Where a codebase and its documentation have drifted apart, when the drift started, and the command that proves it — run against this repository.",
    path: "/audit",
    canary,
    published,
    body
  });
}
