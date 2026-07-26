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

import { historyIsTruncated } from "./dating.js";

export const TEMPLATE_VERSION = "arch-tpl-9";

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

/** Escapes a pipe so a cell containing one does not split the row. */
const cell = (text) => String(text).replaceAll("|", "\\|");

function siteTable(sites) {
  const rows = sites
    .map(
      (s) =>
        `| \`${cell(s.filePath)}\` | ${s.line} | \`${cell(s.value)}\` | \`${cell(s.sourceLine)}\` |`
    )
    .join("\n");
  return `| File | Line | Value | As written |\n| --- | --- | --- | --- |\n${rows}`;
}

/**
 * Figures in a table, commands in their own block below each one.
 *
 * The commands were table cells until the page rendered for the first time and a
 * `git grep -E '(90|70|50)'` split itself across three columns — a document showing
 * a command that would not run, in the section whose whole purpose is letting the
 * reader check the numbers without trusting the document.
 */
function claimBlocks(claims) {
  const table = [
    `| Figure | Value |`,
    `| --- | --- |`,
    ...claims.map((c) => `| ${cell(c.label)} | ${cell(c.expected)} |`)
  ].join("\n");

  const commands = claims
    .map((c) => `**${c.label}**\n\n\`\`\`\n${c.reproduceWith}\n\`\`\``)
    .join("\n\n");

  return `${table}\n\nEach figure again, with the command that reproduces it:\n\n${commands}`;
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

  // Not "two engines". The word was written for this repository, where the two files
  // genuinely are a policy engine and an allocation engine — and it followed the
  // template into fastify, where the two files are `error-handler.js` and
  // `error-status.js` and calling them engines is an invention. A template may not
  // name what it has not observed; `files.length` it has.
  const summary =
    `${files.length} files decide something by comparing \`${subject}\` against the same ${plural}: ${valueList}. ` +
    `The comparison exists at ${sites.length} places across ${files.length} files` +
    (began
      ? `, and the earliest of them had a twin from ${short(began.sha)} onward — ${ago(standingDays)}.`
      : `. When the boundaries came to exist in two files at once is not recoverable from the history.`);

  const gap = began && firstSeen ? interval(firstSeen.at, began.at) : null;
  const truncated = historyIsTruncated();

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
    : truncated
      ? `## When this started

**Not determined.** This repository's history is truncated — a shallow clone, as CI
checkouts are by default — so every date git could return here is a lower bound at an
unknown distance from the truth. Nothing is dated rather than something dated wrongly.

Run again against a full clone (\`git fetch --unshallow\`) and this section fills in.
`
      : `## When this started

Unknown. The history does not show these sites being added, which happens when a file
arrived in a squashed import or was reformatted so the text never appears as an
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

${claimBlocks(claims)}

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

function unimportedModule({ facts, claims }) {
  const { directory, modules, count, documented, neverReferenced, earliest, standingDays } = facts;

  const title = `${count} files in \`${directory}\` are reached by no import in the running program`;

  const summary =
    `No import or require statement in the program resolves to any of ${count} files in ` +
    `\`${directory}\`. ${documented.length} of them are described by name in the documentation. ` +
    (earliest
      ? `The oldest arrived in ${short(earliest.sha)}, "${earliest.subject}", ${ago(standingDays)}.`
      : `When they arrived is not recoverable from the history available here.`);

  const table = [
    `| File | Added | Documented in | Ever imported |`,
    `| --- | --- | --- | --- |`,
    ...modules.map(
      (m) =>
        `| \`${cell(m.path)}\` | ${m.added ? `${short(m.added.sha)} · ${m.added.at.slice(0, 10)}` : "unknown"} ` +
        `| ${m.documentedIn.length ? m.documentedIn.map((d) => `\`${cell(d)}\``).join(", ") : "—"} ` +
        `| ${m.everReferenced === null ? "unknown" : m.everReferenced ? "yes" : "no"} |`
    )
  ].join("\n");

  const documentedSection = documented.length
    ? `## Described in the documentation, and not run

${documented
  .map(
    (m) =>
      `- \`${m.path}\` — named in ${m.documentedIn.map((d) => `\`${d}\``).join(", ")}`
  )
  .join("\n")}

A reader of those documents would take these modules for part of the running system. A
reader of the import graph would not find them at all. Which of the two is wrong is not
something this finding decides.
`
    : "";

  const neverSection = neverReferenced.length
    ? `## Never imported, at any point in the history

${neverReferenced.map((m) => `- \`${m.path}\``).join("\n")}

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.
`
    : "";

  const body = `${summary}

## The files

${table}

${documentedSection}${neverSection}
## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
import specifiers with its own parser, and the check below asks git whether the name
appears in any import or require in the tree.

${claimBlocks(claims)}

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without being imported
— from a service manager, a container command, a \`<script>\` tag, a plugin loader that
builds a path at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so: this codebase passes its
collaborators as arguments, so an import graph would report most of \`src/services\` as
dead. The question asked here is narrower and checkable — whether any import statement
resolves to the file.
`;

  return {
    slug: `unimported-${directory.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    title,
    summary,
    body
  };
}

const TEMPLATES = {
  duplicate_threshold_set: duplicateThresholdSet,
  unimported_module: unimportedModule
};

export function render(candidate) {
  const template = TEMPLATES[candidate.detectorId];
  if (!template) return null;
  return template(candidate);
}
