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

  // An empty JSON container counts as absent. The first version of this check
  // tested only for NULL and '' and reported 17 of 36 — but saveAssessment writes
  // `JSON.stringify(signals || [])`, so a missing input is stored as "[]" or "{}"
  // and sailed past. The true figure was 33 of 36. A check with a hole in it is
  // worse than no check, because it certifies the part it cannot see.
  const EMPTY = `(
       %COL% IS NULL OR TRIM(%COL%) IN ('', '[]', '{}', 'null')
     )`;
  const emptySignals = EMPTY.replaceAll("%COL%", "signals");
  const emptyEvidence = EMPTY.replaceAll("%COL%", "evidence");

  const blank = db
    .prepare(
      `SELECT COUNT(*) AS n FROM TrustAssessment
       WHERE ${emptySignals} OR ${emptyEvidence}`
    )
    .get().n;

  const total = db.prepare("SELECT COUNT(*) AS n FROM TrustAssessment").get().n;

  return {
    article: "Independent Validation",
    name: "Assessments carry their inputs",
    ok: blank === 0,
    detail:
      blank === 0
        ? `all ${total} assessment(s) record the signals and evidence they used`
        : `${blank} of ${total} assessment(s) stored with no signals or no evidence`,
    why: "An interpretation with no recorded inputs cannot be recomputed, and so cannot be corrected."
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
    assessmentsDoNotFeedThemselves(db),
    assessmentsCarryTheirInputs(db),
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
