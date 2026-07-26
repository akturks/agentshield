#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import db, { ROOT, DB_PATH } from "./db.js";
import { coverage } from "./scan.js";
import { DETECTOR_VERSION, DETECTOR_IDS } from "./detectors.js";
import { generatedDocs } from "./generated.js";

// Does this pipeline still obey the rules it publishes under?
//
// The engine already refuses a great deal on its own, and that was measured rather
// than assumed: a candidate with no claims is refused, a claim with no way to check
// it is refused, and a claim whose figure does not reproduce by a second route is
// refused. A detector written next year cannot escape any of those.
//
// What the engine does not touch is everything a *reader* uses. The reproduce command
// beside each figure is written to the database, printed, and published — and never
// executed, not once, anywhere in the pipeline. The seven rules in templates.js about
// how a finding may be worded are comments. So the strongest sentence this tool can
// say — "do not believe me, run the command" — rested entirely on somebody remembering
// to try it by hand. Three times somebody did; the first time, four of sixteen commands
// were fake, and nothing in the pipeline would ever have said so.
//
// The backend's Constitution states it plainly: an article with no executable check is
// an intention rather than a rule. This file is that promise kept for arch.
//
// A check that cannot come back red is decoration. Every check below can.

const REPORT = join(ROOT, "docs", "self-audit.md");

const publishedFindings = db.prepare(
  "SELECT id, slug, title, bodyMarkdown, verifiedAt, publishedAt, detectorId, detectorVersion FROM ArchFinding WHERE status = 'published'"
);

const claimsOf = db.prepare(
  "SELECT label, expected, observed, ok, reproduceWith FROM ArchFindingClaim WHERE findingId = ? ORDER BY rowid"
);

function report() {
  try {
    return readFileSync(REPORT, "utf8");
  } catch {
    return null;
  }
}

/**
 * Article I — every published figure can be reproduced by the command beside it.
 *
 * The one that matters, and the one nothing checked. Each command is run exactly as
 * published, in the repository root, and its output compared to the figure printed next
 * to it. A command that prints a list is compared by its line count, which is what the
 * accompanying label asks for in every case where the output is not a single number.
 */
function everyFigureReproduces() {
  const findings = publishedFindings.all();
  const failures = [];
  let checked = 0;

  for (const finding of findings) {
    for (const claim of claimsOf.all(finding.id)) {
      checked += 1;
      let output;
      try {
        output = execFileSync("bash", ["-c", claim.reproduceWith], {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
          timeout: 120_000
        });
      } catch (err) {
        failures.push(`${finding.slug} · ${claim.label}: command failed — ${err.message.split("\n")[0]}`);
        continue;
      }

      const lines = output.split("\n").filter((l) => l.trim());
      const printed = lines.length === 1 ? lines[0].trim() : String(lines.length);

      if (printed !== claim.expected) {
        failures.push(
          `${finding.slug} · ${claim.label}: published ${claim.expected}, command printed ${printed}`
        );
      }
    }
  }

  return {
    article: "I",
    name: "Every published figure reproduces",
    ok: failures.length === 0 && checked > 0,
    detail:
      checked === 0
        ? "no published figures to check"
        : `${checked - failures.length}/${checked} published commands print the figure beside them`,
    why: failures.join("; ")
  };
}

/**
 * Article II — every published figure was recomputed by a second route before publication.
 *
 * The engine enforces this at the moment a finding is drafted. This checks that it is
 * still true of what is on record, which is a different question: a claim row whose
 * `observed` is null or whose `ok` is 0 means something was published that the verifier
 * did not confirm, however it got there.
 */
function everyFigureWasVerified() {
  const findings = publishedFindings.all();
  const faults = [];
  let checked = 0;

  for (const finding of findings) {
    const claims = claimsOf.all(finding.id);
    if (claims.length === 0) {
      faults.push(`${finding.slug} has no recorded figures`);
      continue;
    }
    for (const claim of claims) {
      checked += 1;
      if (claim.observed === null) faults.push(`${finding.slug} · ${claim.label}: never observed`);
      else if (claim.ok !== 1) faults.push(`${finding.slug} · ${claim.label}: recorded as not ok`);
    }
  }

  return {
    article: "II",
    name: "No figure published without a second opinion",
    ok: faults.length === 0 && checked > 0,
    detail: `${checked} figure(s) on record, each with an independent observation`,
    why: faults.join("; ")
  };
}

/**
 * Article III — what is published was checked by the code that is running now.
 *
 * The first version of this article demanded that `publishedAt` be later than
 * `verifiedAt`, and it failed on all six findings. The pipeline was right and the article
 * was wrong: `restate` re-verifies a published finding under a newer method and keeps its
 * publication date on purpose, so improving a detector never means abandoning what it
 * already reported. Every restatement therefore puts verification after publication, and
 * an article forbidding that forbids the correction loop this whole tool is built on.
 *
 * Rewriting a failing article is the dangerous move — it is how a check gets tuned until
 * it agrees with the code and enforces nothing. The distinction is whether the article
 * asserted something the pipeline ever promised. This one did not; it invented a
 * guarantee about timestamps that nothing had ever claimed.
 *
 * What it should have asked, and now does: every published finding carries the method
 * version currently in force, and was verified under it. That is the claim a reader
 * actually depends on — not "this was checked at some point" but "this was checked by the
 * code you can go and read".
 */
function publishedUnderTheCurrentMethod() {
  const findings = publishedFindings.all();
  const faults = [];

  for (const finding of findings) {
    if (!finding.verifiedAt) {
      faults.push(`${finding.slug} was published without being verified`);
      continue;
    }
    if (finding.detectorVersion !== DETECTOR_VERSION) {
      faults.push(
        `${finding.slug} was drafted by ${finding.detectorVersion}, and the code now runs ${DETECTOR_VERSION}`
      );
    }
  }

  return {
    article: "III",
    name: "Everything published was checked by the method now in force",
    ok: faults.length === 0 && findings.length > 0,
    detail: `${findings.length} published finding(s), all at ${DETECTOR_VERSION}`,
    why: faults.join("; ")
  };
}

/**
 * Article IV — every published finding is one the current code can still produce.
 *
 * Interpretation is meant to be disposable and rebuildable from the observation rows.
 * A finding whose detector no longer exists cannot be rebuilt, cannot be restated under
 * a newer method, and is therefore a conclusion with no way back to its evidence.
 */
function everyFindingIsStillRebuildable() {
  const findings = publishedFindings.all();
  const orphans = findings.filter((f) => !DETECTOR_IDS.has(f.detectorId));

  return {
    article: "IV",
    name: "Every finding can be rebuilt from the observations",
    ok: orphans.length === 0 && findings.length > 0,
    detail: `${findings.length} finding(s) from ${new Set(findings.map((f) => f.detectorId)).size} detector(s) the current code still runs`,
    why: orphans.map((f) => `${f.slug} came from ${f.detectorId}, which no longer exists`).join("; ")
  };
}

/**
 * Article V — the tool does not cite its own output as evidence about the project.
 *
 * This pipeline was built without an action layer and grew one the moment its report was
 * committed. Each unimported-module finding counts how many documents describe a module
 * by name; the report names every module it reports; so publishing it moved one figure
 * from 2 to 9 without anything failing. The guard is in the detector and the verifier,
 * and this is the check that the guard is still doing its job.
 */
function noSelfCitation() {
  const generated = generatedDocs();
  const findings = publishedFindings.all();
  const faults = [];

  for (const finding of findings) {
    for (const path of generated) {
      if (finding.bodyMarkdown.includes(`Documented in`) && finding.bodyMarkdown.includes(path)) {
        faults.push(`${finding.slug} names ${path}, which this tool wrote`);
      }
    }
  }

  return {
    article: "V",
    name: "No finding counts this tool's own output as documentation",
    ok: faults.length === 0,
    detail:
      generated.size === 0
        ? "no generated document exists yet to be miscounted"
        : `${generated.size} generated document(s) excluded from every documentation figure`,
    why: faults.join("; ")
  };
}

/**
 * Article VI — every figure is labelled with a question.
 *
 * Rule 3 in templates.js, made executable. "How many files ..." can be read exactly one
 * way. "Files with this threshold" was read first as a heading and then as an accusation
 * about the files, which is how a label becomes a claim nobody made.
 */
function everyFigureIsAQuestion() {
  const findings = publishedFindings.all();
  const faults = [];
  let checked = 0;

  for (const finding of findings) {
    for (const claim of claimsOf.all(finding.id)) {
      checked += 1;
      if (!/^(How many|How long|When|Which|Where|What|Whether)\b/.test(claim.label)) {
        faults.push(`${finding.slug}: "${claim.label}" is not a question`);
      }
    }
  }

  return {
    article: "VI",
    name: "Every figure is labelled with a question",
    ok: faults.length === 0 && checked > 0,
    detail: `${checked} figure label(s), each one a question a reader can only read one way`,
    why: faults.join("; ")
  };
}

// Words by which a report tells its reader what to do. Rule 4 in templates.js.
const DEONTIC = /\b(should|shall|must|ought to|needs? to|recommend(?:ed|s)?|you (?:can|could|might) (?:now )?(?:fix|change|remove|delete))\b/i;

// Constructions that turn one of those words into a refusal to advise rather than advice.
// "Nothing here says they should be deleted" contains `should` and instructs nobody; the
// rule is about the tool speaking in the imperative, not about a word appearing.
const REFUSAL = /^(nothing|this finding does not|it does not|the tool does not|no part of this)\b/i;

/**
 * Article VII — the report does not tell the reader what to do.
 *
 * Made executable, and honestly an approximation: it reads sentences rather than meaning.
 * The approximation is stated because a check whose limits are hidden is worse than one
 * whose limits are known — a reader who discovers them later is right to discount it.
 */
function theReportGivesNoInstruction() {
  const findings = publishedFindings.all();
  const faults = [];

  for (const finding of findings) {
    const sentences = finding.bodyMarkdown
      .replace(/```[\s\S]*?```/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      if (!DEONTIC.test(sentence)) continue;
      if (REFUSAL.test(sentence)) continue;
      faults.push(`${finding.slug}: "${sentence.slice(0, 90)}"`);
    }
  }

  return {
    article: "VII",
    name: "The report states facts and issues no instruction",
    ok: faults.length === 0,
    detail: `${findings.length} published finding(s), none of which tell the reader what to do`,
    why: faults.join("; ")
  };
}

/**
 * Article VIII — the report says how much of the repository it read.
 *
 * A report of "0 findings" is the most dangerous output this tool can produce: it reads
 * as a clean bill of health and is indistinguishable from a tool that was not looking.
 * Before TypeScript was added this read 12 of etherpad-lite's 1108 files and reported
 * nothing, truthfully. The figures in the report are compared against what `coverage()`
 * answers now, so a stale report fails rather than reassures.
 */
function coverageIsStated() {
  const text = report();
  if (text === null) {
    return {
      article: "VIII",
      name: "The report says how much it read",
      ok: false,
      detail: "no report file at docs/self-audit.md",
      why: "the coverage statement cannot be checked because the report is missing"
    };
  }

  const seen = coverage();
  const stated = text.match(/read \*\*(\d+) files\*\*, out of (\d+) [^.]*?and (\d+) files in total/i);

  if (!stated) {
    return {
      article: "VIII",
      name: "The report says how much it read",
      ok: false,
      detail: "the report carries no coverage statement",
      why: "a finding count without a denominator cannot be interpreted"
    };
  }

  const [, read, source, tracked] = stated.map(Number);
  const matches = read === seen.read && source === seen.source && tracked === seen.tracked;

  return {
    article: "VIII",
    name: "The report says how much it read",
    ok: matches,
    detail: `report states ${read} of ${source} source files, ${tracked} tracked`,
    why: matches
      ? ""
      : `the repository now has ${seen.read} of ${seen.source} source files and ${seen.tracked} tracked — the report is stale`
  };
}

function run() {
  const checks = [
    everyFigureReproduces(),
    everyFigureWasVerified(),
    publishedUnderTheCurrentMethod(),
    everyFindingIsStillRebuildable(),
    noSelfCitation(),
    everyFigureIsAQuestion(),
    theReportGivesNoInstruction(),
    coverageIsStated()
  ];

  console.log("\narch — the rules this pipeline publishes under");
  console.log(`database: ${DB_PATH}\n`);

  for (const c of checks) {
    console.log(`${c.ok ? "  ok  " : " FAIL "} ${c.article} · ${c.name}`);
    console.log(`       ${c.detail}`);
    if (!c.ok && c.why) console.log(`       why: ${c.why}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} articles upheld.`);

  if (failed.length) {
    console.log(
      "\nThe pipeline is defective here, not the article. A check tuned until it agrees\n" +
        "with the code enforces nothing."
    );
  }

  process.exit(failed.length ? 1 : 0);
}

run();
