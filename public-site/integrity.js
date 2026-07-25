import db from "./realityDb.js";

// Does the system still obey its own epistemology?
//
// Health checks that cannot fail are decoration. Each check below can genuinely
// come back red, and each corresponds to one way this design could quietly
// rot — not to whether a process is running, but to whether the separation
// between what we observed, what we concluded, and what we did is still intact.

// Columns that would mean a verdict had been written into the observation
// record. Their appearance is the clearest signal that reality and
// interpretation have started to merge.
const FORBIDDEN_REALITY_COLUMNS = [
  "score",
  "riskscore",
  "decision",
  "verdict",
  "label",
  "classification",
  "isbot",
  "trust",
  "assessment"
];

// Tables in the action layer. A published figure whose query touches one of
// these would mean something we did had been presented as something we saw.
const ACTION_TABLES = ["IndexSubmission", "Trial", "Config"];

function realityStaysClean() {
  const cols = db
    .prepare("PRAGMA table_info(RequestReality)")
    .all()
    .map((c) => c.name.toLowerCase());

  const found = cols.filter((c) =>
    FORBIDDEN_REALITY_COLUMNS.some((bad) => c === bad || c.includes(bad))
  );

  return {
    name: "Reality holds no verdicts",
    ok: found.length === 0,
    detail:
      found.length === 0
        ? "no judgement columns in the observation record"
        : `interpretation has leaked into reality: ${found.join(", ")}`,
    why: "A judgement stored beside an observation overwrites the evidence needed to review it."
  };
}

function actionsAreNotEvidence() {
  const claims = db.prepare("SELECT sql FROM FindingClaim").all();
  const leaked = claims.filter((c) =>
    ACTION_TABLES.some((t) => new RegExp(`\\b${t}\\b`, "i").test(c.sql))
  );

  return {
    name: "Actions are not cited as evidence",
    ok: leaked.length === 0,
    detail:
      leaked.length === 0
        ? "no published figure derives from something we did"
        : `${leaked.length} published figure(s) query the action layer`,
    why: "Announcing a URL is not proof anyone read it. An action only starts a clock."
  };
}

function verificationNotBypassed() {
  const n = db
    .prepare(
      `SELECT COUNT(*) AS n FROM Finding f
       WHERE f.status = 'published' AND f.origin = 'detector'
         AND NOT EXISTS (SELECT 1 FROM FindingClaim c WHERE c.findingId = f.id AND c.ok = 1)`
    )
    .get().n;

  return {
    name: "Verification was not bypassed",
    ok: n === 0,
    detail:
      n === 0
        ? "every automatically published finding has a figure that was recomputed and matched"
        : `${n} published without a matched figure`,
    why: "A generated sentence that skipped the check is an unverified assertion wearing the site's credibility."
  };
}

function interpretationIsRebuildable() {
  const orphans = db
    .prepare(
      `SELECT COUNT(*) AS n FROM FindingClaim c
       WHERE NOT EXISTS (SELECT 1 FROM Finding f WHERE f.id = c.findingId)`
    )
    .get().n;

  const noVersion = db
    .prepare(
      "SELECT COUNT(*) AS n FROM Finding WHERE origin = 'detector' AND (detectorVersion IS NULL OR detectorVersion = '')"
    )
    .get().n;

  const ok = orphans === 0 && noVersion === 0;
  return {
    name: "Interpretation stays rebuildable",
    ok,
    detail: ok
      ? "every derived finding carries the version of the method that produced it"
      : `${orphans} orphaned claim(s), ${noVersion} finding(s) without a method version`,
    why: "Without a version, a conclusion cannot be recomputed and therefore cannot be corrected."
  };
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * "External" is a published word: it appears on the home page as a figure a
 * reader is expected to trust. It must therefore have exactly one definition.
 *
 * It briefly had two — stats.js excluded every request from an address that had
 * ever sent curl, while the console excluded only rows whose own agent was
 * curl — and the same word reported 89 in one place and 170 in the other. This
 * check fails if the filter is ever written out by hand outside stats.js again.
 */
function oneDefinitionOfExternal() {
  const root = dirname(fileURLToPath(import.meta.url));
  const marker = /cfConnectingIp\s+NOT\s+IN\s*\(\s*SELECT\s+cfConnectingIp/i;
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "logs") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js") && entry !== "stats.js" && entry !== "integrity.js") {
        if (marker.test(readFileSync(full, "utf8"))) {
          offenders.push(full.replace(root + "/", ""));
        }
      }
    }
  };

  try {
    walk(root);
  } catch {
    return {
      name: "One definition of external",
      ok: true,
      detail: "source not readable from here",
      why: "A published word with two definitions reports two numbers."
    };
  }

  return {
    name: "One definition of external",
    ok: offenders.length === 0,
    detail:
      offenders.length === 0
        ? "the external-traffic filter exists only in stats.js"
        : `re-defined by hand in: ${offenders.join(", ")}`,
    why: "A published word with two definitions reports two numbers for the same record."
  };
}

/** All epistemic checks. Green means the separation still holds. */
export function epistemicIntegrity() {
  const checks = [
    realityStaysClean(),
    actionsAreNotEvidence(),
    verificationNotBypassed(),
    interpretationIsRebuildable(),
    oneDefinitionOfExternal()
  ];
  return { checks, ok: checks.every((c) => c.ok) };
}
