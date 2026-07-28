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
  // Matched only where a table can appear. The bare word test this replaced
  // went red on a claim counting requests for paths like `%config%`, which
  // cites nothing — it reads the observation record and asks what was fetched.
  //
  // The verifier's own guard is deliberately cruder than this and stays that
  // way, because the two rules are not the same shape. That one decides whether
  // to run a query, so a false positive costs a rewrite and a false negative
  // lets a claim edit the record it checks. This one decides whether a finding
  // is honest, where a false positive marks a sound finding as a violation and
  // there is no danger on the other side to be conservative about.
  //
  // `INSERT INTO` and `UPDATE` need no coverage here; the verifier refuses them
  // before this is ever consulted.
  const claims = db.prepare("SELECT sql FROM FindingClaim").all();
  const leaked = claims.filter((c) =>
    ACTION_TABLES.some((t) => new RegExp(`\\b(?:from|join)\\s+"?${t}"?\\b`, "i").test(c.sql))
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
import { AGENT_OWNER } from "./vendors/sources.js";

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

/**
 * Article IX: no published finding makes a named client the subject of a
 * sentence about conduct.
 *
 * Checked on the headline, because the headline is what gets indexed, quoted and
 * translated. A body can qualify a claim; a title carries it alone.
 *
 * The test is whether a title opens with a company's crawler name. That is a
 * proxy for grammatical subject and it is a proxy that bites: it fails on all six
 * findings withdrawn on 27 July — "ClaudeBot has been observed on this site",
 * "GPTBot has been observed on this site" — and passes "We asked Claude-User to
 * read this page, and it did", where the agent is named but we are the subject.
 * That title was rewritten into that shape deliberately, before this rule
 * existed, for the same reason the rule now exists.
 */
function subjectIsTheBehaviour() {
  const titles = db
    .prepare("SELECT slug, title FROM Finding WHERE status = 'published'")
    .all();

  const named = Object.keys(AGENT_OWNER);
  const offenders = titles.filter((f) =>
    named.some((agent) => new RegExp(`^${agent}\\b`, "i").test(f.title.trim()))
  );

  return {
    name: "The subject is the behaviour",
    ok: offenders.length === 0,
    detail:
      offenders.length === 0
        ? `${titles.length} published title(s), none of which make a named client the subject`
        : `a named client is the subject of: ${offenders.map((f) => f.slug).join(", ")}`,
    why: "A count can be wrong about a number and corrected. A headline can be wrong about a company, and a user agent is a string the sender chose."
  };
}

/**
 * No published finding carries a figure that did not hold.
 *
 * `verificationNotBypassed` above asks a weaker question, and the gap between
 * the two let something through. It looks only at `origin = 'detector'`, because
 * generated prose was the thing being guarded against, and it passes a finding
 * that has *any* matched claim rather than *no* failed one.
 *
 * A hand-written finding was published on 28 July with ten claims matching and
 * two that could not be evaluated at all. Both of those exemptions applied at
 * once: the wrong origin, and enough passing figures to satisfy a check written
 * as an existence test. The page went live rendering the word "mismatch".
 *
 * Nothing about a sentence being typed by a person makes its figures more
 * trustworthy than a generated one — the argument for checking is identical,
 * and the path that publishes them simply never had the gate attached.
 */
function everyPublishedFigureHeld() {
  const offenders = db
    .prepare(
      `SELECT f.slug, COUNT(*) AS failed FROM Finding f
       JOIN FindingClaim c ON c.findingId = f.id
       WHERE f.status = 'published' AND c.ok = 0
       GROUP BY f.slug ORDER BY f.slug`
    )
    .all();

  return {
    name: "Every published figure held",
    ok: offenders.length === 0,
    detail:
      offenders.length === 0
        ? "no published finding carries a claim that failed its recomputation"
        : `carrying failed claims: ${offenders.map((o) => `${o.slug} (${o.failed})`).join(", ")}`,
    why: "A finding is a set of figures with the queries that produced them. One that publishes a figure its own query contradicts is not a weaker finding, it is a different kind of object."
  };
}

/** All epistemic checks. Green means the separation still holds. */
export function epistemicIntegrity() {
  const checks = [
    realityStaysClean(),
    actionsAreNotEvidence(),
    verificationNotBypassed(),
    everyPublishedFigureHeld(),
    interpretationIsRebuildable(),
    oneDefinitionOfExternal(),
    subjectIsTheBehaviour()
  ];
  return { checks, ok: checks.every((c) => c.ok) };
}
