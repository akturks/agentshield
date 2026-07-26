import { execFileSync } from "node:child_process";
import { ROOT } from "./db.js";

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
  return `${escapePosix(subject)}[[:space:]]*${escapePosix(operator)}[[:space:]]*${value}`;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
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
