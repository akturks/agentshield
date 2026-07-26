import db from "./db.js";
import { comparisonPattern, duplicationBegan, changeHistory, daysSince } from "./dating.js";

// What the scan means, kept apart from what the scan saw.
//
// One detector. Not because one is enough, but because the value of the second is
// unknown until the first has been read by someone who could have grepped for it
// themselves and either did or did not find the report worth the reading.
//
// Deliberately not a reachability detector, which was the obvious first choice and
// is a trap in this codebase: `evaluatePipeline` receives every collaborator as an
// argument and server.js supplies them, so naive import analysis reports most of
// `src/services` as unreachable. A detector that is wrong about this repository is
// not a detector, and dependency injection is common enough that getting it wrong
// here means getting it wrong everywhere.

export const DETECTOR_VERSION = "arch-det-3";

// Below this, a repeated number is more likely to be a coincidence of small
// integers than a threshold someone chose twice. The scanner already drops 0, 1
// and 100; this drops the rest of the range where the same value in two files says
// nothing about the design.
const MIN_INTERESTING_VALUE = 10;

const thresholdRows = db.prepare(`
  SELECT subject, operator, value, filePath, line, sourceLine
  FROM RepoReality
  WHERE scanId = ? AND kind = 'threshold_comparison'
  ORDER BY subject, CAST(value AS REAL) DESC, filePath, line
`);

/**
 * One expression switched on at the same thresholds in more than one file.
 *
 * Two decisions here came from reading the first report rather than from designing
 * it, and both changed what the output is worth.
 *
 * The criterion is the subject together with the value, not the value alone. Value
 * alone finds 14 groups in this repository and most are noise: 200 and 202 are HTTP
 * status codes, and small integers repeat for unrelated reasons. Adding the subject
 * leaves 6, all real.
 *
 * And the grouping is per expression, not per value. Grouping per value reported
 * `risk.riskScore >= 90`, `>= 70` and `>= 50` as three findings about the same two
 * files — three reports of one structural fact, which is how a tool teaches its
 * reader to skim. They are one finding: two engines that both branch on the same
 * number at the same three boundaries.
 */
export function duplicateThresholdSet(scanId) {
  const rows = thresholdRows.all(scanId);

  // subject -> value -> sites
  const bySubject = new Map();
  for (const row of rows) {
    if (Number(row.value) < MIN_INTERESTING_VALUE) continue;
    if (!bySubject.has(row.subject)) bySubject.set(row.subject, new Map());
    const byValue = bySubject.get(row.subject);
    if (!byValue.has(row.value)) byValue.set(row.value, []);
    byValue.get(row.value).push(row);
  }

  const candidates = [];

  for (const [subject, byValue] of bySubject) {
    // Only the values this expression is compared against in more than one file.
    const shared = [...byValue.entries()].filter(
      ([, sites]) => new Set(sites.map((s) => s.filePath)).size > 1
    );
    if (shared.length === 0) continue;

    const sites = shared.flatMap(([, s]) => s);
    const files = [...new Set(sites.map((s) => s.filePath))].sort();
    const operator = sites[0].operator;

    // Dated per value, because each boundary arrived on its own. The one reported
    // as the beginning is the earliest, since that is when this expression first
    // had a threshold in two files at once.
    const perValue = shared
      .map(([value, valueSites]) => {
        const valueFiles = [...new Set(valueSites.map((s) => s.filePath))];
        const history = duplicationBegan(
          valueFiles.map((filePath) => ({ filePath, subject, operator, value }))
        );
        const edits = valueFiles.flatMap((filePath) =>
          changeHistory({ filePath, subject, operator, value })
        );
        return {
          value,
          files: valueFiles,
          began: history.began,
          firstSeen: history.first,
          undated: history.undated,
          // More than one commit per site means the text was edited after it
          // existed in two places — the case where one file gets a new number and
          // the other keeps the old one.
          editedAfterwards: edits.length > valueFiles.length,
          editCount: edits.length
        };
      })
      .sort((a, b) => Number(b.value) - Number(a.value));

    const dated = perValue.filter((v) => v.began);
    const began = dated.length
      ? dated.reduce((earliest, v) => (v.began.at < earliest.began.at ? v : earliest)).began
      : null;
    const firstSeen = dated.length
      ? dated.reduce((earliest, v) => (v.firstSeen.at < earliest.firstSeen.at ? v : earliest)).firstSeen
      : null;

    const patterns = perValue.map((v) => comparisonPattern({ subject, operator, value: v.value }));
    const anyPattern = `${comparisonPattern({ subject, operator, value: "" })}(${perValue
      .map((v) => v.value)
      .join("|")})`;

    candidates.push({
      detectorId: "duplicate_threshold_set",
      subjectKey: `${subject} ${operator} [${perValue.map((v) => v.value).join(",")}] @ ${files.join(",")}`,
      // A repeated threshold can be deliberate — two engines may be meant to agree
      // on a boundary. The counts cannot settle that, so a person reads it.
      requiresReview: true,
      facts: {
        subject,
        operator,
        files,
        sites,
        values: perValue,
        fileCount: files.length,
        siteCount: sites.length,
        began,
        firstSeen,
        standingDays: began ? daysSince(began.at) : null
      },
      claims: [
        {
          label: `How many files compare \`${subject}\` against every one of these ${perValue.length} value(s)`,
          expected: String(files.length),
          // Verified by re-running this, not by trusting the scan that produced the
          // figure. The scanner is a lexer written here; git's regex engine is not.
          // Two mechanisms agreeing is worth more than one repeated.
          // git grep matches text, so this also lists any file that merely mentions
          // the comparison in a comment — this file does, further up. The figure
          // counts code only, and the table of sites in the finding names every one
          // of them, so the reader can see which hits the figure left out and why.
          reproduceWith: `git grep -lE '${anyPattern}' -- '*.js'   # text, so a file that only mentions it in a comment appears too`,
          verify: { kind: "git-grep-files-all", patterns }
        },
        {
          label: `How many places compare \`${subject}\` against one of these value(s)`,
          expected: String(sites.length),
          reproduceWith: `git grep -nE '${anyPattern}' -- '*.js'   # one line per hit; the table above lists the ones that are code`,
          verify: { kind: "git-grep-sites-any", patterns }
        },
        ...(began
          ? [
              {
                label: "The commit where this expression first had a threshold in two files",
                expected: began.sha.slice(0, 8),
                reproduceWith: `git log --pickaxe-regex -S'${comparisonPattern({ subject, operator, value: dated.find((v) => v.began.sha === began.sha).value })}' --reverse --format='%h %aI %s' -- ${began.filePath} | head -1`,
                verify: {
                  kind: "first-appearance",
                  filePath: began.filePath,
                  subject,
                  operator,
                  value: dated.find((v) => v.began.sha === began.sha).value
                }
              }
            ]
          : [])
      ]
    });
  }

  return candidates;
}

export const DETECTORS = [duplicateThresholdSet];

export function detectAll(scanId) {
  return DETECTORS.flatMap((detector) => detector(scanId));
}
