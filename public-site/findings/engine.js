import { randomUUID } from "node:crypto";
import db, { SITE_ID } from "../realityDb.js";
import { detectAll, DETECTOR_VERSION } from "./detectors.js";
import { render, TEMPLATE_VERSION } from "./templates.js";
import { verifyFinding, VERIFIER_VERSION } from "./verifier.js";
import { recordPublication, recordRejection } from "../anchor.js";
import { submitOne } from "../geo/indexnow.js";

// detect → draft → verify → publish.
//
// The publication gate is per detector rather than global. A rule whose output
// is a direct restatement of a count can publish itself; a rule that implies
// something about intent or identity waits for a person, because the cost of a
// wrong one there is the credibility of everything else on the site.

export const ENGINE_VERSION = `${DETECTOR_VERSION}/${TEMPLATE_VERSION}/${VERIFIER_VERSION}`;

// Detectors whose findings publish without review once verified.
const AUTO_PUBLISH = new Set([
  "ai_agent_arrival",
  "format_preference",
  "automated_enumeration"
]);

// robots_violation and identity_inconsistency stay manual: both say something
// unflattering about a named actor, and a false one would be worse than a
// missing one.
//
// js_execution is manual for a different reason. Reaching the beacon proves a
// script ran, but it attributes that to a declared user agent, and a user agent
// is unverifiable — anyone may fetch the probe under any name and have the
// execution recorded against it. The beacon now requires a real, recent,
// once-only probe response, which stops replay and invented identifiers, but it
// cannot stop someone claiming to be a crawler they are not. A capability
// finding about a named agent therefore gets read by a person first.

const findExisting = db.prepare(
  `SELECT id, status FROM Finding
   WHERE siteId = ? AND detectorId = ? AND subjectKey IS ? AND windowStartMs IS ?`
);

const insertFinding = db.prepare(`
  INSERT INTO Finding (
    id, siteId, slug, detectorId, detectorVersion, origin, status,
    title, summary, bodyHtml, subjectKey, windowStartMs, windowEndMs, detectedAt
  ) VALUES (
    @id, @siteId, @slug, @detectorId, @detectorVersion, @origin, @status,
    @title, @summary, @bodyHtml, @subjectKey, @windowStartMs, @windowEndMs, @detectedAt
  )
`);

const markVerified = db.prepare(
  "UPDATE Finding SET status = ?, verifiedAt = ?, publishedAt = ?, rejectedReason = ? WHERE id = ?"
);

const dropClaims = db.prepare("DELETE FROM FindingClaim WHERE findingId = ?");
const dropFinding = db.prepare("DELETE FROM Finding WHERE id = ?");

const slugTaken = db.prepare("SELECT 1 FROM Finding WHERE slug = ? AND id != ?");

function uniqueSlug(slug, id) {
  let candidate = slug;
  let n = 2;
  while (slugTaken.get(candidate, id)) candidate = `${slug}-${n++}`;
  return candidate;
}

/**
 * One pass. Detects, drafts, verifies, and publishes or holds. Returns a
 * summary of what happened so a scheduled run leaves a trace.
 */
export function runOnce({ siteId = SITE_ID, verbose = false } = {}) {
  const now = new Date().toISOString();
  const candidates = detectAll(siteId);
  const result = { detected: candidates.length, created: 0, published: 0, pending: 0, rejected: 0, skipped: 0 };

  for (const candidate of candidates) {
    // A finding is identified by what it is about and when, so re-running the
    // engine restates nothing it has already recorded.
    const existing = findExisting.get(
      siteId,
      candidate.detectorId,
      candidate.subjectKey ?? null,
      candidate.windowStartMs ?? null
    );
    if (existing) {
      result.skipped += 1;
      continue;
    }

    const drafted = render(candidate);
    if (!drafted) {
      result.skipped += 1;
      continue;
    }

    const id = randomUUID();
    const slug = uniqueSlug(drafted.slug, id);

    insertFinding.run({
      id,
      siteId,
      slug,
      detectorId: candidate.detectorId,
      detectorVersion: DETECTOR_VERSION,
      origin: "detector",
      status: "pending",
      title: drafted.title,
      summary: drafted.summary,
      bodyHtml: drafted.body,
      subjectKey: candidate.subjectKey ?? null,
      windowStartMs: candidate.windowStartMs ?? null,
      windowEndMs: candidate.windowEndMs ?? null,
      detectedAt: now
    });
    result.created += 1;

    const verdict = verifyFinding(id, candidate.claims ?? []);

    if (!verdict.ok) {
      // A draft whose figures do not survive recomputation is discarded, not
      // filed away — keeping it would leave an unverified claim in the store.
      dropClaims.run(id);
      dropFinding.run(id);
      result.created -= 1;
      result.rejected += 1;
      if (verbose) console.log(`[findings] rejected ${candidate.detectorId}: ${verdict.reason}`);
      continue;
    }

    if (AUTO_PUBLISH.has(candidate.detectorId)) {
      markVerified.run("published", verdict.checkedAt, now, null, id);
      recordPublication({ slug, title: drafted.title, detectorId: candidate.detectorId }, { automatic: true });
      announce(`/findings/${slug}`);
      result.published += 1;
      if (verbose) console.log(`[findings] published ${slug}`);
    } else {
      markVerified.run("pending", verdict.checkedAt, null, null, id);
      result.pending += 1;
      if (verbose) console.log(`[findings] held for review ${slug}`);
    }
  }

  return result;
}

const listByStatus = db.prepare(
  `SELECT id, slug, detectorId, origin, status, title, summary, bodyHtml,
          detectedAt, publishedAt, verifiedAt
   FROM Finding WHERE siteId = ? AND status = ?
   ORDER BY COALESCE(publishedAt, detectedAt) DESC`
);

export function published(siteId = SITE_ID) {
  return listByStatus.all(siteId, "published");
}

export function pending(siteId = SITE_ID) {
  return listByStatus.all(siteId, "pending");
}

const bySlugStmt = db.prepare(
  `SELECT id, slug, detectorId, origin, status, title, summary, bodyHtml,
          detectedAt, publishedAt, verifiedAt
   FROM Finding WHERE slug = ? AND status = 'published'`
);

export function bySlug(slug) {
  return bySlugStmt.get(slug);
}

/** Tells the indexes a page exists. Never blocks or throws into publication. */
function announce(path) {
  submitOne(path).catch((err) =>
    console.error("[indexnow] announce failed:", err.message)
  );
}

const findingById = db.prepare(
  "SELECT id, slug, title, detectorId FROM Finding WHERE id = ?"
);

/** Promotes a held finding after a person has read it. */
export function approve(id) {
  const f = findingById.get(id);
  const at = new Date().toISOString();
  const ok = markVerified.run("published", at, at, null, id).changes > 0;
  if (ok && f) {
    recordPublication(f, { automatic: false });
    announce(`/findings/${f.slug}`);
  }
  return ok;
}

export function reject(id, reason) {
  const f = findingById.get(id);
  const ok =
    db
      .prepare("UPDATE Finding SET status = 'rejected', rejectedReason = ? WHERE id = ?")
      .run(reason ?? "rejected by review", id).changes > 0;
  if (ok && f) recordRejection(f, reason);
  return ok;
}
