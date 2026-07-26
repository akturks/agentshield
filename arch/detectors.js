import db from "./db.js";
import { execFileSync } from "node:child_process";
import { ROOT } from "./db.js";
import {
  comparisonPattern,
  duplicationBegan,
  changeHistory,
  moduleHistory,
  reachedPattern,
  daysSince
} from "./dating.js";
import { isGeneratedDoc, GENERATED_MARKER } from "./generated.js";
import { NOT_PROGRAM_PATTERN, SOURCE_PATHSPEC } from "./scan.js";

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

export const DETECTOR_VERSION = "arch-det-17";

// Below this, a repeated number is more likely to be a coincidence of small
// integers than a threshold someone chose twice. The scanner already drops 0, 1
// and 100; this drops the rest of the range where the same value in two files says
// nothing about the design.
const MIN_INTERESTING_VALUE = 10;

// The pathspec every published command searches, quoted for the shell and built from the
// one list of extensions this tool reads. It was written out by hand in five commands,
// which is how `.cjs` came to be missing from one of them.
const pathspec = SOURCE_PATHSPEC.map((p) => `'${p}'`).join(" ");

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

  // subject and operator together -> value -> sites.
  //
  // The operator was not part of the key, and the group then took its operator from
  // whichever site happened to be first. `statusCode === 200` and `statusCode >= 200` are
  // not the same boundary — one is a test for a status, the other is a test for a class
  // of statuses — and fastify has both, as does axios for `httpVersion`, and sequelize
  // for two length checks. Sixteen such groups exist in etherpad-lite alone.
  //
  // The merge did not surface as a refused finding, because the verifier builds its
  // pattern from the same first-site operator: both sides then search for one operator
  // and count sites matching it, and agree. Another definition wrong in both places, and
  // this one was found by asking the databases a question rather than by reading output.
  const byExpression = new Map();
  for (const row of rows) {
    if (Number(row.value) < MIN_INTERESTING_VALUE) continue;
    const key = `${row.subject}\u0000${row.operator}`;
    if (!byExpression.has(key)) byExpression.set(key, new Map());
    const byValue = byExpression.get(key);
    if (!byValue.has(row.value)) byValue.set(row.value, []);
    byValue.get(row.value).push(row);
  }

  const candidates = [];

  for (const [key, byValue] of byExpression) {
    const [subject, operator] = key.split("\u0000");
    // Only the values this expression is compared against in more than one file.
    const shared = [...byValue.entries()].filter(
      ([, sites]) => new Set(sites.map((s) => s.filePath)).size > 1
    );
    if (shared.length === 0) continue;

    const sites = shared.flatMap(([, s]) => s);
    const files = [...new Set(sites.map((s) => s.filePath))].sort();

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
          //
          // The trailing filter drops hits on lines that open with a comment marker.
          // Without it these commands print a superset of the figure — a file that
          // only mentions the comparison in prose appears, and arch/detectors.js and
          // arch/verifier.js both do, because they quote it as the example that
          // taught this. A published command whose output disagrees with the
          // published number is worse than no command, so the command matches. It is
          // a line-level approximation of what the scan does properly by stripping
          // comments and strings, which is why the figure is checked that way and
          // not by parsing this output.
          reproduceWith: `git grep -nE '${anyPattern}' -- ${pathspec} | grep -vE ':[0-9]+:[[:space:]]*(//|\\*|/\\*)' | cut -d: -f1 | sort -u`,
          verify: { kind: "git-grep-files-all", patterns }
        },
        {
          label: `How many places compare \`${subject}\` against one of these value(s)`,
          expected: String(sites.length),
          reproduceWith: `git grep -nE '${anyPattern}' -- ${pathspec} | grep -vE ':[0-9]+:[[:space:]]*(//|\\*|/\\*)'`,
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

// Both ways a file can be reached, in one NOT EXISTS. An `import` row is a resolved
// specifier; a `path_literal` row is the program writing the file's name down somewhere
// else — a `fork`, a `spawn`, a worker, a table of plugin paths. Asking only about
// imports called all four of pm2's process containers dead, and every one of them is
// launched by name from `lib/God.js`.
const unimportedModules = db.prepare(`
  SELECT m.value AS path
  FROM RepoReality m
  WHERE m.scanId = ? AND m.kind = 'module' AND m.subject = 'module'
    AND NOT EXISTS (
      SELECT 1 FROM RepoReality r
      WHERE r.scanId = m.scanId
        AND r.kind IN ('import', 'path_literal')
        AND r.resolvesTo = m.value
    )
  ORDER BY m.value
`);

/**
 * Whether anything outside the JavaScript names this file.
 *
 * A module can be loaded without being imported: a `<script src>` tag, a Dockerfile
 * command, a CI step, a service manager unit. Those are declarations, and looking for
 * them beats guessing from the filename — `public-site/server.js` and `browser-sdk.js`
 * both came out of the first measurement as unimported, and both are started from
 * outside the module graph.
 *
 * Markdown is excluded on purpose. Prose describing a module is not prose loading it,
 * and the case worth reporting most is exactly a module the documentation presents as
 * part of the system while nothing runs it.
 */
function namedOutsideJavaScript(relPath) {
  const base = relPath.split("/").pop();
  try {
    const out = execFileSync(
      "git",
      ["grep", "-l", "-F", base, "--", ":!*.js", ":!*.mjs", ":!*.cjs", ":!*.md"],
      { cwd: ROOT, encoding: "utf8" }
    );
    return out.split("\n").filter(Boolean).length;
  } catch (err) {
    if (err.status === 1) return 0;
    throw err;
  }
}

/**
 * Which Markdown files written by the project mention this module by name.
 *
 * This tool's own reports are excluded, and the reason is not tidiness. The report lists
 * every module it reports, so the first published one turned `src/services` from 2
 * documented into 9 — nine modules "described in the documentation" by the document
 * saying nothing describes them. See `arch/generated.js`.
 */
function documentedIn(relPath) {
  const base = relPath.split("/").pop();
  try {
    const out = execFileSync("git", ["grep", "-l", "-F", base, "--", "*.md"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    return out.split("\n").filter(Boolean).filter((path) => !isGeneratedDoc(path));
  } catch (err) {
    if (err.status === 1) return [];
    throw err;
  }
}

/**
 * Modules nothing imports, grouped by the directory they sit in.
 *
 * This is the detector the first one should have been. `duplicate_threshold_set` found
 * two findings in this repository and one across four mature open-source projects, and
 * the one it found was true and trivial. What this repository actually suffers from is
 * different in kind: services and repositories written for a pipeline that was never
 * wired, several of them described in the documentation as though they run.
 *
 * Grouped per directory rather than per file, for the reason that turned five threshold
 * findings into two: seven unimported repositories in `repositories/` is one fact about
 * this codebase, and seven findings about it would teach the reader to skim.
 *
 * Not reachability analysis, which stays out of this tool for a good reason —
 * `evaluatePipeline` receives every collaborator as an argument, and an import graph
 * would call most of `src/services` dead. This asks something far weaker and checkable:
 * does any import statement anywhere resolve to this file. Dependency injection still
 * imports what it injects, at the injection site.
 */
export function unimportedModule(scanId) {
  // Grouped first, dated second, and the order is the whole cost of this detector.
  //
  // Dating asks git to walk the entire history once per module, which on sequelize is
  // 11,866 commits a time. Doing it before the grouping dated every candidate — including
  // every directory holding exactly one, which the filter below then discards. The work
  // was thrown away after being paid for, and it was most of the runtime.
  const byDirectory = new Map();

  for (const { path } of unimportedModules.all(scanId)) {
    if (namedOutsideJavaScript(path) > 0) continue;
    const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";
    if (!byDirectory.has(directory)) byDirectory.set(directory, []);
    byDirectory.get(directory).push({ path, directory });
  }

  for (const [directory, group] of byDirectory) {
    if (group.length < 2) {
      byDirectory.delete(directory);
      continue;
    }
    for (const entry of group) {
      const history = moduleHistory(entry.path);
      entry.documentedIn = documentedIn(entry.path);
      entry.added = history.added;
      entry.everReferenced = history.everReferenced;
    }
  }

  const candidates = [];

  // A single unimported file in a directory is a normal thing in a working repo — a
  // script, something half-written, something about to be wired. A cluster is a different
  // claim, and the one worth a person's attention. Those are already gone: the loop above
  // drops them before paying to date them.
  for (const [directory, modules] of byDirectory) {

    const documented = modules.filter((m) => m.documentedIn.length > 0);
    const neverReferenced = modules.filter((m) => m.everReferenced === false);
    const dated = modules.filter((m) => m.added).sort((a, b) => a.added.at.localeCompare(b.added.at));
    const paths = modules.map((m) => m.path).join(" ");

    // The pattern the published commands search with, derived from the one the verifier
    // uses rather than written out again beside it. Both commands below held their own
    // copy until this line existed, and one of the copies had already drifted — it was
    // missing the whitespace exclusion, so the command a reader runs was asking a wider
    // question than the figure beside it answered. `__B__` stands in for the shell
    // variable so the pattern can be built by the same function and then substituted.
    const shellPattern = reachedPattern("__B__")
      .replaceAll('"', '\\"')
      .replaceAll("`", "\\`")
      .replaceAll("__B__", "$b");

    candidates.push({
      detectorId: "unimported_module",
      subjectKey: directory,
      requiresReview: true,
      facts: {
        directory,
        modules: modules.sort((a, b) => a.path.localeCompare(b.path)),
        count: modules.length,
        documented,
        neverReferenced,
        earliest: dated[0]?.added ?? null,
        latest: dated[dated.length - 1]?.added ?? null,
        standingDays: dated[0]?.added ? daysSince(dated[0].added.at) : null
      },
      claims: [
        {
          label: `How many files in \`${directory}\` the program never names, tests aside`,
          expected: String(modules.length),
          // Four stages, and each one is a rule the figure above also applies. The
          // pathspec is every extension the scan reads; the first filter drops matches
          // on lines that open a comment, because a name written in prose is not the
          // program naming a file; the second drops files the scan does not treat as
          // part of the program, via the same list; the third drops the file's own
          // definition of itself.
          reproduceWith:
            `for f in ${paths}; do b=$(basename "$f" .js); ` +
            `git grep -nE "${shellPattern}" -- ${pathspec} ` +
            `| grep -vE ':[0-9]+:[[:space:]]*(//|\\*|/\\*)' | cut -d: -f1 ` +
            `| grep -vE '${NOT_PROGRAM_PATTERN}' | grep -vxF "$f" ` +
            `| grep -q . || echo "$f"; done | wc -l`,
          verify: { kind: "unimported-count", paths: modules.map((m) => m.path) }
        },
        {
          label: `How many of those the documentation describes by name`,
          expected: String(documented.length),
          // The first line excludes this tool's own reports, which is the difference
          // between 2 and 9 here. The report names every module it reports, so counting
          // it as documentation makes the figure describe the report instead of the
          // project — and a published command that prints 9 beside a published 2 costs
          // the reader more trust than the figure was ever worth.
          reproduceWith:
            `gen=$(git grep -l -F '${GENERATED_MARKER}' -- '*.md')\n` +
            `for f in ${paths}; do ` +
            `git grep -l -F "$(basename "$f")" -- '*.md' | grep -vxF "$gen" >/dev/null && echo "$f"; ` +
            `done | wc -l`,
          verify: { kind: "documented-count", paths: modules.map((m) => m.path) }
        },
        {
          label: `How many the program has never named, in any commit in the history`,
          expected: String(neverReferenced.length),
          // Runnable, which it was not. This was published as a sketch carrying a
          // `<basename>` placeholder — a line that reads like a command, prints nothing
          // when pasted, and leaves the one figure a reader cannot check by eye
          // unverifiable by exactly the reader most likely to try.
          reproduceWith:
            `n=0\n` +
            `for f in ${paths}; do b=$(basename "$f" .js); ` +
            `git log --pickaxe-regex -S"${shellPattern}" --format=%H -- ${pathspec} ` +
            `| grep -q . || n=$((n+1)); done\n` +
            `echo "$n"`,
          verify: { kind: "never-referenced-count", paths: modules.map((m) => m.path) }
        }
      ]
    });
  }

  return candidates;
}

export const DETECTORS = [duplicateThresholdSet, unimportedModule];

export function detectAll(scanId) {
  return DETECTORS.flatMap((detector) => detector(scanId));
}
