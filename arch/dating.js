import { execFileSync } from "node:child_process";
import { ROOT } from "./db.js";
import { EXTENSION_GROUP, SOURCE_PATHSPEC } from "./scan.js";

// When did this start?
//
// This is the question the whole exercise is for. A report that says two files
// define the same threshold tells a reader something they could have grepped. A
// report that says the second one appeared in b67f34b, four minutes after the
// first, tells them which change introduced the divergence and what its author
// was doing at the time — which is the difference between a lint warning and a
// piece of history.
//
// git's pickaxe does the work: -S with --pickaxe-regex lists the commits where
// the number of matches for a pattern changed in a given file. The first such
// commit, walking forward, is where the text arrived.
//
// Note the regex dialect. git uses POSIX regex here, so `\s` matches a literal
// 's' and the first version of this silently returned nothing for every input —
// a dating function that always answers "unknown" and never errors. POSIX classes
// are used below for that reason.

/**
 * A pattern matching any import or require of a module with this basename.
 *
 * Exported so `moduleHistory` and the verifier ask the identical question. They did not
 * at first: each built its own version, they disagreed on winston by 23 of 25, and the
 * finding was refused. That is the fourth time in this tool that two paths differed over
 * a *definition* rather than a fact — after what counts as code, which extensions exist,
 * and which files are part of the program.
 *
 * The rule that keeps emerging: independence belongs in the search, never in the
 * vocabulary. Two mechanisms, one definition.
 */
export function namedPattern(basename) {
  const stem = escapePosix(basename.replace(extensionRe, ""));
  // The basename must sit at a path boundary — right after the opening quote, or after a
  // slash. Without that, `system.js` matches `require('./filesystem-provider')`, because
  // `filesystem` ends in `system`, and the verifier reported project-anchor's
  // `src/ollama/prompt/system.js` as imported when nothing imports it. Same shape as the
  // `statusCode` / `err.statusCode` widening in comparisonPattern, and the same fix:
  // a pattern with no left boundary silently answers a wider question than it was asked.
  // The prefix must end in a slash or be absent entirely. Anything looser reopens the
  // `filesystem` / `system` widening one character at a time: `[^'"`]*/?` lets the
  // prefix swallow `./file` and match the `system` inside `filesystem`.
  //
  // And it must contain no whitespace, because a quoted path is not a quoted command.
  // Without that, `"git log -- src/services/outcomeEngineService.js"` matches, and this
  // said the module was named while the scan — which had the rule — said it was not.
  // Same word, two definitions, one refused finding: the sixth time in this tool.
  return `['\"\`]([^'\"\`[:space:]]*/)?${stem}(\\.(${EXTENSION_GROUP}))?['\"\`]`;
}

/**
 * A pattern matching any string literal that names a module with this basename.
 *
 * Note what this does *not* require: an import keyword. pm2 starts four of its own
 * modules by writing their names into `child_process.fork`, and the earlier version of
 * this insisted on `from` or `require` before the quote. All four came back as reached by
 * nothing, and the verifier agreed, because both paths were reading the same too-narrow
 * definition — which is the exact limit of sharing one: independence in the *search*
 * catches a broken lexer, and never catches a definition that is wrong in both places.
 * Only pointing the tool at code it did not write catches that.
 */
export function importPattern(basename) {
  return `(from|require)[^'\"]*${namedPattern(basename)}`;
}

/**
 * A pattern matching a string literal that is a *path* to this module.
 *
 * The extension is required, and that single character of difference is the whole rule.
 * Without an import keyword in front of it, a quoted string ending in a bare module name
 * is not evidence of anything — etherpad-lite writes `fetch("./tokenTransfer")` for an
 * HTTP route, `['importexport', 'timeslider']` for a list of toolbar buttons, and
 * `"admin": string` for a key in a type. All three matched the extensionless pattern, so
 * the verifier called three modules reached that nothing loads, and refused a finding the
 * scan had got right.
 *
 * A module referred to without an extension is still found, by `importPattern` — because
 * there the keyword supplies the evidence the extension would otherwise have to.
 *
 * This is the seventh time two paths in this tool have differed over a definition rather
 * than a fact, and the third time the correction went this way: the narrow side was
 * right, and the wide side had been quietly agreeing with things it had not checked.
 */
export function pathLiteralPattern(basename) {
  const stem = escapePosix(basename.replace(extensionRe, ""));
  return `['\"\`]([^'\"\`[:space:]]*/)?${stem}\\.(${EXTENSION_GROUP})['\"\`]`;
}

/** Either way a file's name can appear in code: as a path, or behind an import keyword. */
export function reachedPattern(basename) {
  return `(${importPattern(basename)}|${pathLiteralPattern(basename)})`;
}

const extensionRe = new RegExp(`\\.(${EXTENSION_GROUP})$`);

/** Escapes a string for use inside a POSIX basic regular expression. */
function escapePosix(text) {
  return text.replace(/[.[\]*^$\\+?(){}|/]/g, (c) => `\\${c}`);
}

/**
 * A pattern matching `subject <operator> <value>` with any spacing or line break
 * between the parts.
 *
 * The parts are matched separately because this codebase writes comparisons
 * across three lines as often as one, and a pattern assuming a single line finds
 * nothing in half the files here.
 */
export function comparisonPattern({ subject, operator, value }) {
  // Anchored on the left, or the pattern silently widens its own subject. Running
  // this against fastify, `statusCode >= 400` also matched `err.statusCode >= 400`
  // and `error.statusCode >= 400` — three different expressions, which the scan had
  // correctly kept apart. The verifier counted 3 files where the scan said 2 and the
  // finding was refused; the scan was right. `[^_$.[:alnum:]]` keeps a match from
  // being preceded by a word character or a dot, and `(^|...)` allows the start of
  // a line.
  return `(^|[^_$.[:alnum:]])${escapePosix(subject)}[[:space:]]*${escapePosix(operator)}[[:space:]]*${value}`;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/**
 * Whether this repository's history has been truncated.
 *
 * Dating is the one thing here a reader cannot easily check for themselves, so it is
 * the one place a confident wrong answer does the most damage — and a shallow clone
 * produces exactly that. Run against a `--depth 400` clone of fastify, the tool
 * reported `statusCode >= 400` as first appearing in `51933de5`, "test: replace
 * removed request properties", on 2025-05-11. That commit is the shallow boundary:
 * the oldest one present, not the one that introduced anything. The pickaxe cannot
 * see past it and does not say so.
 *
 * CI checkouts are shallow by default, so this is the common case rather than the
 * exotic one. When the history is truncated nothing is dated at all: every date the
 * pickaxe could return is a lower bound of unknown distance from the truth, and
 * "unknown" is the only honest answer available.
 */
let shallowCache = null;
export function historyIsTruncated() {
  if (shallowCache !== null) return shallowCache;
  try {
    shallowCache =
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        cwd: ROOT,
        encoding: "utf8"
      }).trim() === "true";
  } catch {
    shallowCache = false;
  }
  return shallowCache;
}

/**
 * The commit that first put this comparison into this file.
 *
 * Returns null when git cannot find one, which happens for real reasons — the
 * file arrived in a squashed import, or the text was reformatted so the pattern
 * never appears as an addition. Null is reported as unknown rather than guessed
 * at, and a finding says which of its sites could not be dated.
 */
export function firstAppearance({ filePath, subject, operator, value }) {
  if (historyIsTruncated()) return null;
  const pattern = comparisonPattern({ subject, operator, value });
  let out;
  try {
    out = git([
      "log",
      "--pickaxe-regex",
      `-S${pattern}`,
      "--reverse",
      "--format=%H%x09%aI%x09%s",
      "--",
      filePath
    ]);
  } catch {
    return null;
  }

  const first = out.split("\n").find((line) => line.trim().length > 0);
  if (!first) return null;

  const [sha, at, subjectLine] = first.split("\t");
  return { sha, at, subject: subjectLine, filePath, pattern };
}

/**
 * When a threshold stopped living in one place.
 *
 * The duplication does not begin when the first site appears — one definition is
 * not a duplicate. It begins when the last of them arrives, so that is the commit
 * reported, with the earlier one alongside it for the interval between them.
 */
export function duplicationBegan(sites) {
  const dated = sites
    .map((site) => ({ site, appearance: firstAppearance(site) }))
    .filter((entry) => entry.appearance !== null);

  const undated = sites.length - dated.length;

  if (dated.length < 2) {
    return { began: null, first: null, undated, dated: dated.length };
  }

  dated.sort((a, b) => a.appearance.at.localeCompare(b.appearance.at));

  return {
    first: dated[0].appearance,
    began: dated[dated.length - 1].appearance,
    undated,
    dated: dated.length
  };
}

/**
 * Every commit that changed how many times this comparison appears in this file.
 *
 * One entry means the text arrived and was never touched again. More than one
 * means somebody edited it after it existed in two places — which is the case
 * worth reporting, because that is where a threshold gets changed here and left
 * alone there. The first draft of this report asserted the two sites "have moved
 * independently since" without checking, and that clause was removed rather than
 * softened: an unverified sentence next to three verified figures makes the reader
 * distrust the figures.
 */
export function changeHistory({ filePath, subject, operator, value }) {
  if (historyIsTruncated()) return [];
  const pattern = comparisonPattern({ subject, operator, value });
  let out;
  try {
    out = git([
      "log",
      "--pickaxe-regex",
      `-S${pattern}`,
      "--reverse",
      "--format=%H%x09%aI%x09%s",
      "--",
      filePath
    ]);
  } catch {
    return [];
  }

  return out
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [sha, at, subjectLine] = line.split("\t");
      return { sha, at, subject: subjectLine, filePath };
    });
}

/** How long the divergence has stood, in whole days. */
export function daysSince(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/**
 * When a file was added, and whether the program ever named it.
 *
 * "Nothing reaches this" is a fact about now. The question a reader actually has is
 * whether it was ever wired up — a module written for a pipeline that never shipped is
 * a different story from one that was connected and then orphaned, and only the second
 * has a commit where somebody removed the last caller.
 *
 * The pickaxe is asked with `reachedPattern`, so a module launched by path rather than
 * imported counts as referenced. It has to be the same question the detector asks about
 * the present, or the report says "never imported" of a file that a `fork` call has been
 * starting since 2013.
 */
export function moduleHistory(relPath) {
  if (historyIsTruncated()) return { added: null, referenceCommits: [], everReferenced: null };

  let added = null;
  try {
    const out = git([
      "log",
      "--diff-filter=A",
      "--follow",
      "--format=%H%x09%aI%x09%s",
      "--",
      relPath
    ]);
    const lines = out.split("\n").filter((l) => l.trim());
    const last = lines[lines.length - 1];
    if (last) {
      const [sha, at, subject] = last.split("\t");
      added = { sha, at, subject };
    }
  } catch {
    added = null;
  }

  let referenceCommits = [];
  try {
    const out = git([
      "log",
      "--pickaxe-regex",
      `-S${reachedPattern(relPath.split("/").pop())}`,
      "--format=%H%x09%aI%x09%s",
      "--",
      ...SOURCE_PATHSPEC
    ]);
    referenceCommits = out
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        const [sha, at, subject] = l.split("\t");
        return { sha, at, subject };
      });
  } catch {
    referenceCommits = [];
  }

  return { added, referenceCommits, everReferenced: referenceCommits.length > 0 };
}
