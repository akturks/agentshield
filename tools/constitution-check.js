#!/usr/bin/env node
import Database from "better-sqlite3";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Does the implementation still obey docs/CONSTITUTION.md?
//
// The Constitution says an article with no executable check is an intention
// rather than a rule. This file is the first instalment of that promise for the
// backend, which had no enforcement at all while the public observatory has had
// five checks for days — and the difference showed: the observatory caught every
// violation of its own epistemology within hours, while these documents drifted
// into three incompatible "canonical" pipelines without anything failing.
//
// A check that cannot come back red is decoration. Every check below can, and at
// the time of writing two of them do. That is the point: the first honest run of
// an enforcement tool finds real debt, and reporting it is more useful than
// tuning the tool until it agrees with the code.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = process.env.AGENTSHIELD_DB ?? join(ROOT, "agentshield.db");

// Names that mean a judgement has been written onto an observation. Reality
// records what happened; a score or a decision is what someone concluded about
// what happened, and storing it beside the observation overwrites the evidence
// needed to review it later.
const JUDGEMENT_COLUMNS = [
  "riskscore",
  "score",
  "decision",
  "verdict",
  "trustscore",
  "classification",
  "label",
  "isbot",
  "assessment"
];

// Tables that hold observations under the Reality Boundary: what was received,
// not what was concluded.
const REALITY_TABLES = ["Event", "Outcome", "Session"];

function columns(db, table) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  } catch {
    return null;
  }
}

/** Reality Boundary: "Interpretations are not Reality Objects." */
function realityHoldsNoJudgements(db) {
  const found = [];

  for (const table of REALITY_TABLES) {
    const cols = columns(db, table);
    if (!cols) continue;
    for (const col of cols) {
      if (JUDGEMENT_COLUMNS.some((bad) => col.toLowerCase() === bad)) {
        found.push(`${table}.${col}`);
      }
    }
  }

  return {
    article: "Reality Boundary",
    name: "Reality holds no judgements",
    ok: found.length === 0,
    detail:
      found.length === 0
        ? "no judgement columns on an observation table"
        : `interpretation stored on reality: ${found.join(", ")}`,
    why: "A verdict stored beside an observation destroys the evidence needed to revisit it."
  };
}

/** Independent Validation: "Evidence for an assessment may not be derived from that assessment." */
function assessmentsDoNotFeedThemselves(db) {
  const cols = columns(db, "TrustAssessment");
  if (!cols) {
    return {
      article: "Independent Validation",
      name: "Assessments do not cite themselves",
      ok: true,
      detail: "no TrustAssessment table in this database",
      why: "A conclusion that is its own evidence cannot be checked."
    };
  }

  // The evidence column is a JSON blob. If any stored evidence refers to a trust
  // assessment, the conclusion is resting on its own output.
  let selfReferential = 0;
  try {
    const rows = db.prepare("SELECT evidence FROM TrustAssessment WHERE evidence IS NOT NULL").all();
    selfReferential = rows.filter((r) =>
      /trustassessment|assessmentid|"assessment"/i.test(String(r.evidence))
    ).length;
  } catch {
    selfReferential = 0;
  }

  return {
    article: "Independent Validation",
    name: "Assessments do not cite themselves",
    ok: selfReferential === 0,
    detail:
      selfReferential === 0
        ? "no stored assessment cites an assessment as its evidence"
        : `${selfReferential} assessment(s) cite an assessment as evidence`,
    why: "A conclusion that is its own evidence cannot be checked."
  };
}

/** Purpose: "this sentence is the platform's only self-description." */
function oneSelfDescription() {
  const CLAIM = /AgentShield is an?\s+([^.\n]{4,90})/gi;
  const CANONICAL = "independent behavioural trust and evidence platform";
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git" || entry === "archive") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".md")) {
        const text = readFileSync(full, "utf8");
        for (const m of text.matchAll(CLAIM)) {
          const claim = m[1].trim().replace(/\s+/g, " ");
          if (!claim.toLowerCase().startsWith(CANONICAL.slice(0, 30))) {
            offenders.push(`${full.replace(ROOT + "/", "")}: "${claim}"`);
          }
        }
      }
    }
  };

  try {
    walk(join(ROOT, "docs"));
    for (const f of ["README.md", "SYSTEM_OF_RECORD.md"]) {
      const full = join(ROOT, f);
      try {
        const text = readFileSync(full, "utf8");
        for (const m of text.matchAll(CLAIM)) {
          const claim = m[1].trim().replace(/\s+/g, " ");
          if (!claim.toLowerCase().startsWith(CANONICAL.slice(0, 30))) {
            offenders.push(`${f}: "${claim}"`);
          }
        }
      } catch {
        /* file absent */
      }
    }
  } catch {
    return {
      article: "Purpose",
      name: "One self-description",
      ok: true,
      detail: "docs not readable from here",
      why: "A system with several identities has no identity."
    };
  }

  return {
    article: "Purpose",
    name: "One self-description",
    ok: offenders.length === 0,
    detail:
      offenders.length === 0
        ? "every document describes the platform the same way"
        : `competing self-description in ${offenders.length} place(s): ${offenders.join(" | ")}`,
    why: "A system with several identities has no identity, and its documents cannot be reconciled."
  };
}

/** Independent Validation: an interpretation must be recomputable. */
function assessmentsCarryTheirInputs(db) {
  const cols = columns(db, "TrustAssessment");
  if (!cols) {
    return {
      article: "Independent Validation",
      name: "Assessments carry their inputs",
      ok: true,
      detail: "no TrustAssessment table in this database",
      why: "An interpretation with no recorded inputs cannot be recomputed, and so cannot be corrected."
    };
  }

  const missing = ["signals", "evidence"].filter((c) => !cols.includes(c));
  if (missing.length) {
    return {
      article: "Independent Validation",
      name: "Assessments carry their inputs",
      ok: false,
      detail: `TrustAssessment has no ${missing.join(", ")} column`,
      why: "An interpretation with no recorded inputs cannot be recomputed, and so cannot be corrected."
    };
  }

  // The violation is a signal without its evidence, not an empty column.
  //
  // Two earlier versions of this check were both wrong, in opposite directions.
  // The first tested only for NULL and '' and reported 17 of 36, missing every
  // row where saveAssessment had written `JSON.stringify(signals || [])` as "[]".
  // Tightening that to treat empty containers as absent gave 33 of 36 — and
  // over-reported, because it counted 25 rows that are empty for a legitimate
  // reason: no rule fired. An assessment of an identity that triggered nothing
  // has no inputs to record and is fully determined by the baseline, so it is
  // recomputable and conformant. What is not conformant is an assessment that
  // names a signal and cannot say what the signal was based on.
  //
  // So the comparison is between the two columns rather than inside each one.
  // The counted figure below is 8, not 33, and the quiet rows are reported
  // alongside it so the smaller number cannot be read as debt swept out of view.
  const rows = db
    .prepare("SELECT signals, evidence, modelVersions FROM TrustAssessment")
    .all();

  function parse(text, fallback) {
    if (text === null || text === undefined) return fallback;
    try {
      const value = JSON.parse(text);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  // Rows are judged on which side of the guarantee they were written.
  //
  // The eight bad rows cannot be repaired, so a check that counts them can only
  // ever be red, and the single thing that would turn it green is deleting them.
  // A rule whose only satisfying move is destroying the evidence of its own
  // violation is not a rule. But exempting them by date would let the fix be
  // asserted rather than shown.
  //
  // The boundary is therefore read from the row itself: an assessment carrying a
  // method version was written by a path that also enforces its inputs, because
  // the same function requires both. Rows without one predate that path. The
  // verdict is about the rows the current code produced; the older ones are
  // counted and named in the same sentence, every run, and never subtracted.
  //
  // The verdict is also refused while no such row exists. A guarantee that has
  // never once been exercised is a claim, and this file does not certify claims.
  let quiet = 0;
  let unsupported = 0;
  let orphaned = 0;
  let legacyFaults = 0;
  let guaranteed = 0;

  for (const row of rows) {
    const signals = parse(row.signals, []);
    const evidence = parse(row.evidence, {});
    const named = Array.isArray(signals) ? signals : [];
    const supported = Object.entries(evidence)
      .filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== ""))
      .map(([k]) => k);

    const underGuarantee = Boolean(row.modelVersions);
    if (underGuarantee) guaranteed += 1;

    let fault = null;
    if (named.length === 0) {
      if (supported.length > 0) fault = "orphaned";
    } else if (named.some((s) => !supported.includes(s))) {
      fault = "unsupported";
    }

    if (!fault) {
      if (named.length === 0) quiet += 1;
      continue;
    }
    if (!underGuarantee) legacyFaults += 1;
    else if (fault === "unsupported") unsupported += 1;
    else orphaned += 1;
  }

  const total = rows.length;
  const faults = [];
  if (unsupported) faults.push(`${unsupported} name a signal with no evidence for it`);
  if (orphaned) faults.push(`${orphaned} record evidence for no signal`);

  const debt = legacyFaults
    ? `; ${legacyFaults} of ${total} predate the guarantee, cannot be repaired, and are not counted here`
    : "";
  const idle = `the write path now refuses an unsupported signal, but no assessment has been stored under it yet${debt}`;

  return {
    article: "Independent Validation",
    name: "Assessments carry their inputs",
    ok: faults.length === 0 && guaranteed > 0,
    detail:
      guaranteed === 0
        ? idle
        : faults.length === 0
          ? `every signal in the ${guaranteed} assessment(s) written under the guarantee has the evidence it rests on` +
            (quiet ? ` (${quiet} of all ${total} fired no rule and correctly record nothing)` : "") +
            debt
          : `of ${guaranteed} assessment(s) written under the guarantee, ${faults.join(", ")}${debt}`,
    why: "An interpretation with no recorded inputs cannot be recomputed, and so cannot be corrected."
  };
}

/**
 * Independent Validation: an assessment must record enough to be recomputed.
 *
 * Signals and evidence are not the whole input. `buildTrustAssessment` computes
 * `getModelVersions()` and returns it, and it reads `observedEventCount` to
 * produce `trustDimensions` — and `saveAssessment` persists none of the three.
 * So every stored assessment is missing the version of the method that made it
 * and one of the numbers that method consumed. Replaying it would silently use
 * today's model against yesterday's row.
 *
 * This check fails on every existing assessment. It is added anyway, and before
 * the fix rather than after, because the Constitution says an article with no
 * executable check is an intention rather than a rule — and because a gap found
 * by writing the check is worth more than one described in a paragraph.
 */
function assessmentsCanBeRecomputed(db) {
  const cols = columns(db, "TrustAssessment");
  const article = "Independent Validation";
  const name = "Assessments can be recomputed";
  const why =
    "Replaying an assessment without its method version and its inputs applies today's model to yesterday's row.";

  if (!cols) {
    return { article, name, ok: true, detail: "no TrustAssessment table in this database", why };
  }

  const REQUIRED = ["modelVersions", "observedEventCount"];
  const absent = REQUIRED.filter((c) => !cols.includes(c));
  const total = db.prepare("SELECT COUNT(*) AS n FROM TrustAssessment").get().n;

  if (absent.length) {
    return {
      article,
      name,
      ok: false,
      detail: `TrustAssessment has no ${absent.join(", ")} column, so none of its ${total} row(s) can be replayed`,
      why
    };
  }

  // Same boundary as the check above, for the same reason: the 36 existing rows
  // were written before these columns existed and nothing can fill them in now.
  // What is testable is that every row written since carries both — and that at
  // least one has been, so the column is not merely present but used.
  const complete = db
    .prepare(
      `SELECT COUNT(*) AS n FROM TrustAssessment
       WHERE modelVersions IS NOT NULL AND TRIM(modelVersions) NOT IN ('', '{}', '[]', 'null')
         AND observedEventCount IS NOT NULL`
    )
    .get().n;

  const partial = db
    .prepare(
      `SELECT COUNT(*) AS n FROM TrustAssessment
       WHERE (modelVersions IS NOT NULL AND TRIM(modelVersions) NOT IN ('', '{}', '[]', 'null'))
         AND observedEventCount IS NULL`
    )
    .get().n;

  const legacy = total - complete - partial;
  const debt = legacy
    ? `; ${legacy} predate the columns and cannot be filled in`
    : "";

  return {
    article,
    name,
    ok: partial === 0 && complete > 0,
    detail:
      complete === 0 && partial === 0
        ? `the columns exist and saveAssessment requires them, but no assessment has been stored since${debt}`
        : partial === 0
          ? `all ${complete} assessment(s) written since record their method version and the count they consumed${debt}`
          : `${partial} of ${complete + partial} recent assessment(s) carry a method version but not the count it consumed${debt}`,
    why
  };
}

/**
 * Reality Boundary: a verdict moved off reality has to stay recomputable.
 *
 * Moving riskScore and decision into EventAssessment fixes where they are stored
 * and nothing else. The table is new, so it has no habits yet — and Event had no
 * check at all for the eight weeks it spent accumulating verdicts nobody could
 * replay. This exists so the same thing cannot happen twice in the same codebase.
 *
 * Judged on the same boundary as the assessment checks: rows carrying a method
 * version were written by the path that requires reasons alongside it.
 */
function eventVerdictsCarryTheirReasons(db) {
  const article = "Reality Boundary";
  const name = "Verdicts about events carry their reasons";
  const why =
    "A score with no recorded reasons cannot be recomputed from the request that produced it.";
  const cols = columns(db, "EventAssessment");

  if (!cols) {
    return { article, name, ok: true, detail: "no EventAssessment table in this database", why };
  }

  const total = db.prepare("SELECT COUNT(*) AS n FROM EventAssessment").get().n;
  const under = db
    .prepare("SELECT COUNT(*) AS n FROM EventAssessment WHERE methodVersion IS NOT NULL")
    .get().n;
  const faulty = db
    .prepare(
      `SELECT COUNT(*) AS n FROM EventAssessment
       WHERE methodVersion IS NOT NULL
         AND (reasons IS NULL OR TRIM(reasons) IN ('', 'null'))`
    )
    .get().n;

  const legacy = total - under;
  const debt = legacy
    ? `; ${legacy} were moved off Event and never recorded a basis, which cannot now be supplied`
    : "";

  return {
    article,
    name,
    ok: faulty === 0 && under > 0,
    detail:
      under === 0
        ? `saveEventAssessment requires reasons and a method version, but no verdict has been stored under it yet${debt}`
        : faulty === 0
          ? `all ${under} verdict(s) written under the guarantee record the reasons they were built from${debt}`
          : `${faulty} of ${under} recent verdict(s) record no reasons${debt}`,
    why
  };
}

function run() {
  let db;
  try {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch (err) {
    console.error(`cannot open ${DB_PATH}: ${err.message}`);
    console.error("set AGENTSHIELD_DB to point at the database to check.");
    process.exit(2);
  }

  const checks = [
    realityHoldsNoJudgements(db),
    eventVerdictsCarryTheirReasons(db),
    assessmentsDoNotFeedThemselves(db),
    assessmentsCarryTheirInputs(db),
    assessmentsCanBeRecomputed(db),
    oneSelfDescription()
  ];

  console.log("\nAgentShield Constitution v2 — implementation check");
  console.log(`database: ${DB_PATH}\n`);

  for (const c of checks) {
    console.log(`${c.ok ? "  ok  " : " FAIL "} ${c.article} · ${c.name}`);
    console.log(`       ${c.detail}`);
    if (!c.ok) console.log(`       why: ${c.why}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${checks.length - failed.length}/${checks.length} articles upheld by the implementation.`
  );

  if (failed.length) {
    console.log(
      "\nUnder the Status clause, the implementation is defective here — not the\n" +
        "Constitution. These are recorded rather than silenced; a check tuned until\n" +
        "it agrees with the code enforces nothing."
    );
  }

  db.close();
  process.exit(failed.length ? 1 : 0);
}

run();
