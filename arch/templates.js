// Turns a candidate into something a person can read and act on.
//
// The three rules the observatory's templates learned the hard way apply here too,
// because the reader may run this through a translator and a mistranslated claim is
// worse than an untranslated one:
//
//   1. The claim goes in the subject, never in a verb a translator can re-tense.
//   2. No sentence opens with a plural noun — "Requests ask for X" came back from
//      Turkish as an invitation to make requests.
//   3. A figure's label is a question, never a fragment. "How many files ..." can
//      only be read one way; "Files with this threshold" was read first as a
//      heading and then as a claim that the files were defective.
//
// Two rules specific to this pipeline, both from reading the first report:
//
//   4. Never write "should" or "must". A duplicated threshold may be deliberate.
//   5. Never state a consequence that was not checked. The first draft said the two
//      sites "have moved independently since", which nothing had established. It is
//      now either a verified statement about edits or it is absent. An unverified
//      sentence beside three verified figures costs the figures their credibility.
//   6. State the one limit that changes what to do. This detector cannot tell whether
//      both sites run, and a duplicated threshold in code nothing calls needs a
//      different fix — so every finding says so. The alternative was holding such a
//      finding back until a second detector existed, which stores the doubt in a
//      queue where no reader ever sees it and pays off once instead of every time.

export const TEMPLATE_VERSION = "arch-tpl-4";

const short = (sha) => (sha ? sha.slice(0, 8) : "unknown");

/**
 * "49 days ago", "yesterday", "today".
 *
 * The first version printed "0 days ago" for anything under twenty-four hours,
 * which reads as a rounding error rather than as a date and undercut a sentence
 * that was otherwise correct.
 */
function ago(days) {
  if (days === null || days === undefined) return "at an unknown date";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function siteTable(sites) {
  const rows = sites
    .map((s) => `| \`${s.filePath}\` | ${s.line} | \`${s.value}\` | \`${s.sourceLine}\` |`)
    .join("\n");
  return `| File | Line | Value | As written |\n| --- | --- | --- | --- |\n${rows}`;
}

function claimTable(claims) {
  const rows = claims
    .map((c) => `| ${c.label} | ${c.expected} |\n| ↳ reproduce | \`${c.reproduceWith}\` |`)
    .join("\n");
  return `| Figure | Value |\n| --- | --- |\n${rows}`;
}

/** "3 hours" when both sides arrived the same day, "12 days" otherwise. */
function interval(fromIso, toIso) {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

function duplicateThresholdSet({ facts, claims }) {
  const { subject, operator, files, sites, values, began, firstSeen, standingDays } = facts;
  const valueList = values.map((v) => `\`${v.value}\``).join(", ");
  const plural = values.length === 1 ? "boundary" : "boundaries";

  const title =
    `\`${subject}\` is compared against the same ${values.length} ${plural} in ${files.length} separate files`;

  const summary =
    `Two engines branch on \`${subject}\` at the same ${plural}: ${valueList}. ` +
    `The comparison exists at ${sites.length} places across ${files.length} files` +
    (began
      ? `, and the earliest of them had a twin from ${short(began.sha)} onward — ${ago(standingDays)}.`
      : `. When the boundaries came to exist in two files at once is not recoverable from the history.`);

  const gap = began && firstSeen ? interval(firstSeen.at, began.at) : null;

  const history = began
    ? `## When this started

\`${subject}\` first got one of these boundaries in ${short(firstSeen.sha)}, "${firstSeen.subject}", on ${firstSeen.at.slice(0, 10)}.

A second file gained the same boundary ${gap ? `${gap} later` : "afterwards"}, in ${short(began.sha)}, "${began.subject}" — ${ago(standingDays)}.

${values
  .map((v) =>
    v.began
      ? `- \`${v.value}\` — duplicated from ${short(v.began.sha)}, ${v.began.at.slice(0, 10)}` +
        (v.editedAfterwards
          ? `, and edited in ${v.editCount} commits since, so one file may hold a value the other does not`
          : `; neither site has been edited since`)
      : `- \`${v.value}\` — not datable from the history`
  )
  .join("\n")}
`
    : `## When this started

Unknown. The history does not show these sites being added, which happens when a
file arrived in a squashed import or was reformatted so the text never appears as an
addition. Reported as unknown rather than estimated.
`;

  const body = `${summary}

## Where it is

${siteTable(sites)}

${history}
## Verified figures

Each was recomputed by a different route than the one that produced it: the scan
counts what its own lexer found, and the check below counts what git's regex engine
finds in the working tree.

${claimTable(claims)}

## What this finding does not say

Two files agreeing on a boundary can be deliberate. Nothing here establishes that
the repetition is a defect — only that the numbers exist in more than one place, and
since when.

Nothing here establishes that both sites run. A boundary duplicated into code that
nothing calls is a different problem with a different fix, and the reader who
reconciles two numbers when one of them is unreachable has been sent to the wrong
work. This paragraph is not a hedge — it is the one limit of this detector that
changes what to do about a finding, so it is stated on every one of them until a
detector exists that can settle the question.

The scan reads text rather than syntax. A boundary assembled by arithmetic, or held
in a variable and compared elsewhere, is invisible to it.
`;

  return {
    slug: `duplicate-thresholds-${subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    title,
    summary,
    body
  };
}

const TEMPLATES = { duplicate_threshold_set: duplicateThresholdSet };

export function render(candidate) {
  const template = TEMPLATES[candidate.detectorId];
  if (!template) return null;
  return template(candidate);
}
