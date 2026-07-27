import { page, escapeHtml, instant } from "../layout.js";
import { weeklyReport, weeksObserved, latestWeek } from "../weekly.js";

// The report page. Everything it prints comes from `weekly.js`; what it adds is
// the sentence around each figure, and the sentences are chosen by the figures
// rather than written for a good week.
//
// The hard part of a recurring report is not the busy week. It is the week where
// nothing happened, because that is the week a bulletin starts reaching for
// significance. This page is built to say "eleven requests, and that is not a
// trend" without apology — Article VI on a schedule.
//
// Comparison with the previous week is printed and then explicitly disarmed. Two
// points make a line through any two numbers; they do not make a direction. The
// guard stays until there are enough weeks for the question to be askable, and
// deciding when that is will itself be a judgement rather than a threshold.

function trendNote(now, before, complete) {
  if (before === 0) return "There is no previous week to compare against.";
  if (!complete)
    return `The week is still in progress, so this is a partial count against a full one (${before.toLocaleString(
      "en-US"
    )} last week). Nothing can be read from the direction yet.`;

  const delta = now - before;
  const pct = Math.abs(Math.round((delta / before) * 100));
  const word = delta === 0 ? "the same as" : delta > 0 ? `${pct}% above` : `${pct}% below`;

  return `That is ${word} the previous week (${before.toLocaleString("en-US")}). Two weeks
    is two points. It is not a direction, and this line will keep saying so until there
    are enough weeks for the question to mean something.`;
}

function quietNote(r) {
  if (r.requests === 0)
    return `<p>No external request was recorded in this week at all. The record says
      nothing happened, which is a result rather than a gap — the instrument was
      running and can be checked on <a href="/status">the status page</a>.</p>`;

  if (r.identities.requests === 0)
    return `<p>No client declared one of the AI crawler identities this site checks
      for during this week. That is worth stating plainly rather than filling: most
      weeks on a small site will look like this, and a report that only appears when
      something happened is not a record.</p>`;

  return "";
}

function figures(r) {
  return `<div class="grid">
<div><div class="stat">${escapeHtml(r.requests.toLocaleString("en-US"))}</div><div class="stat-label">External requests</div></div>
<div><div class="stat">${escapeHtml(r.addresses.toLocaleString("en-US"))}</div><div class="stat-label">Distinct addresses</div></div>
<div><div class="stat">${escapeHtml(r.agents.toLocaleString("en-US"))}</div><div class="stat-label">Distinct user agents</div></div>
<div><div class="stat">${escapeHtml(r.paths.toLocaleString("en-US"))}</div><div class="stat-label">Distinct paths</div></div>
</div>`;
}

function identityTable(r) {
  const i = r.identities;
  if (i.requests === 0) return "";

  return `<div class="scroll"><table>
<thead><tr><th>Declared an AI crawler identity</th><th>Requests</th></tr></thead>
<tbody>
<tr><td>Corroborated by the vendor's published range</td><td>${i.verified}</td></tr>
<tr><td>A different range belonging to the same vendor</td><td>${i.vendor_other}</td></tr>
<tr><td><strong>Contradicted</strong> — vendor publishes a list, this address is not on it</td><td><strong>${i.unlisted}</strong></td></tr>
<tr><td>Uncheckable — no published list exists</td><td>${i.unverifiable}</td></tr>
<tr><td>Total</td><td>${i.requests}</td></tr>
</tbody></table></div>

<p>Checked against the vendor snapshot captured ${escapeHtml(r.snapshot ?? "—")}, never a
live fetch, so this table reproduces. Only <em>contradicted</em> is evidence against a
client, and <em>uncheckable</em> is a gap in a vendor's publishing rather than anything
about the client. <a href="/lab#checked">The running totals</a> carry the same split.</p>`;
}

function decisions(r) {
  if (r.published.length === 0 && r.rejected.length === 0)
    return `<p>No finding was published or rejected in this week.</p>`;

  // Published findings carry their summary here, rejected ones carry nothing but
  // a count.
  //
  // A list of titles is a table of contents, and a week reported as a table of
  // contents tells a returning reader what was filed rather than what was
  // learned. The summary is the finding's own sentence about what happened, so
  // quoting it keeps this page computed rather than written — nobody composes a
  // weekly digest, and the week still reads like one.
  //
  // The asymmetry is deliberate and is the rule that already governs the
  // withdrawn list on /findings: most rejected findings said something
  // unsupported about a client, and reprinting that sentence under the word
  // "rejected" puts the claim back on an indexable page where a crawler reads
  // the sentence and not the label.
  // Published findings carry their summary; rejected ones carry a count.
  //
  // A list of titles is a table of contents, and a week reported as a table of
  // contents tells a returning reader what was filed rather than what was
  // learned. The summary is the finding's own sentence about what happened, so
  // quoting it keeps this page computed rather than written — nobody composes a
  // weekly digest, and the week still reads like one.
  //
  // Rejected titles were printed here until this week, while the paragraph
  // below claimed they never were. The claim was the correct rule and the code
  // was the live behaviour, and on 27 July the two met: a finding was withdrawn
  // under Article IX for making a crawler the subject of its headline, and this
  // page was ready to reprint that headline verbatim under the word "rejected".
  //
  // Nothing would have caught it. The integrity check reads findings whose
  // status is 'published', and a withdrawn sentence reappearing on a different
  // page is outside what it looks at. A crawler reads the sentence, not the
  // label above it.
  const published = (rows) =>
    rows.length === 0
      ? ""
      : `<p><strong>${rows.length} published:</strong></p>${rows
          .map(
            (f) =>
              `<div class="qa"><h3><a href="/findings/${escapeHtml(f.slug)}">${escapeHtml(f.title)}</a></h3><p>${escapeHtml(f.summary ?? "")}</p></div>`
          )
          .join("")}`;

  const withdrawn = (rows) =>
    rows.length === 0
      ? ""
      : `<p><strong>${rows.length} withdrawn or rejected.</strong> The subject and the
reason for each are listed on <a href="/findings#withdrawn">the findings page</a>.</p>`;

  return `${published(r.published)}${withdrawn(r.rejected)}
<p>Rejections are counted here and never named, because publishing an unverified
statement about a client in order to prove it was rejected repeats the offence. The
count is the part that matters: a review step that has never rejected anything has not
been shown to be one.</p>`;
}

export function weeklyPage(label, canary, published) {
  const r = weeklyReport(label);
  if (!r) return null;

  const weeks = weeksObserved();
  const body = `
<h1>Week ${escapeHtml(r.label)}</h1>

<p class="lede">${escapeHtml(instant(r.from))} to ${escapeHtml(instant(r.to))}${
    r.complete ? "" : " — the week is still in progress"
  }. Every figure on this page is computed from the record when the page is
requested, not written down afterwards.</p>

${figures(r)}

<p>${trendNote(r.requests, r.previousRequests, r.complete)}</p>

${
  r.requests > 0
    ? `<p><strong>The largest single address contributed ${escapeHtml(
        r.busiest.toLocaleString("en-US")
      )} of those requests — ${escapeHtml(String(r.busiestShare))}%.</strong> Anyone
can add to this count; nothing here refuses a client, because refusing traffic would
change what the instrument can measure. So the concentration is published beside the
total rather than prevented.</p>`
    : ""
}

${quietNote(r)}

<h2>Declared identities</h2>

${
  r.identities.requests === 0
    ? "<p>None this week.</p>"
    : identityTable(r)
}

<h2>Behaviour</h2>

<div class="scroll"><table>
<thead><tr><th>Measurement</th><th>This week</th></tr></thead>
<tbody>
<tr><td>Fetches of paths disallowed in <a href="/robots.txt">robots.txt</a></td><td>${r.disallowed}</td></tr>
<tr><td>Requests carrying a conditional header</td><td>${r.conditional}</td></tr>
</tbody></table></div>

<p>Both figures are small and both are honest about why. The disallowed paths serve
ordinary content and are listed so that compliance is measurable rather than assumed.
Conditional requests can only be counted on the formats where the validator survives
the CDN — <a href="/cdn-interventions">which is not all of them</a>.</p>

<h2>Findings decided</h2>

${decisions(r)}

<h2>Markers</h2>

<p>${escapeHtml(String(r.markersPublished))} new marker${
    r.markersPublished === 1 ? "" : "s"
  } published this week, ${escapeHtml(String(r.markersTotal))} live in total.
<strong>${escapeHtml(String(r.markersObserved))} have ever been observed in a language
model's output.</strong></p>

<p>That last number is the one this site exists to move, and it has been zero since the
first day. It is printed every week whether or not it changes, because a counter that
only appears when it is interesting is a counter nobody can trust.
<a href="/glossary/canary-token">What a marker is</a>.</p>

<hr>

<h2>Other weeks</h2>

<ul>${weeks
    .map(
      (w) =>
        `<li>${
          w === r.label
            ? `<strong>${escapeHtml(w)}</strong> — this week`
            : `<a href="/weekly/${escapeHtml(w)}">${escapeHtml(w)}</a>`
        }</li>`
    )
    .join("")}</ul>

<p>Each week keeps its own address permanently, so a figure quoted from here can be
checked against the week it was quoted from. Reports are recomputed on every request,
which means an older week's page may change if the record behind it is corrected — the
figures are a view of the record, never a snapshot taken away from it.</p>
`;

  return page({
    title: `Week ${r.label}`,
    description: `What this site observed between ${r.from.slice(0, 10)} and ${r.to.slice(
      0,
      10
    )}: ${r.requests} external requests, ${r.identities.requests} claiming an AI crawler identity, ${
      r.markersObserved
    } markers ever seen in a model's output.`,
    path: label === latestWeek() ? "/weekly" : `/weekly/${label}`,
    canary,
    published,
    schemaType: "Report",
    body
  });
}
