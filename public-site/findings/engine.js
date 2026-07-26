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
// distributed_crawl stays manual for the same reason in a weaker form. Its
// figures are counts, but the shape they describe is only interesting if one
// party arranged it, and that is not something the counts can settle — the same
// fan-out arrives from unrelated people sharing a common mobile user agent. The
// template says so, and a person confirms the reading before it publishes.
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

    // A detector may withdraw its own publication right for one candidate. An
    // arrival that overlaps a trial we ran is the case this exists for: the rule
    // publishes itself in general, but not when part of what it counted may be
    // something we caused.
    if (AUTO_PUBLISH.has(candidate.detectorId) && !candidate.requiresReview) {
      markVerified.run("published", verdict.checkedAt, now, null, id);
      recordPublication({ slug, title: drafted.title, detectorId: candidate.detectorId }, { automatic: true });
      announce(`/findings/${slug}`);
      result.published += 1;
      if (verbose) console.log(`[findings] published ${slug}`);
    } else {
      markVerified.run("pending", verdict.checkedAt, null, candidate.reviewReason ?? null, id);
      result.pending += 1;
      if (verbose) console.log(`[findings] held for review ${slug}`);
    }
  }

  return result;
}

const restateFinding = db.prepare(
  `UPDATE Finding SET title = @title, summary = @summary, bodyHtml = @bodyHtml,
          detectorVersion = @detectorVersion, verifiedAt = @verifiedAt
   WHERE id = @id`
);

// Takes a published finding off the site and puts it back in the queue.
//
// `publishedAt` is deliberately left alone. It was published, at that instant,
// and to whoever read it then — erasing the timestamp would make the record
// claim it never happened, which is the one thing this project may not do. The
// same choice `reject()` already makes for a withdrawn finding.
//
// `rejectedReason` carries the reason. The column name predates this use; what
// it actually holds is "why this is not currently published", and a withdrawal
// is one of those. Prefixed so the two cases stay distinguishable in the record.
const withdrawFinding = db.prepare(
  `UPDATE Finding SET status = 'pending', rejectedReason = @reason,
          title = @title, summary = @summary, bodyHtml = @bodyHtml,
          detectorVersion = @detectorVersion, verifiedAt = @verifiedAt
   WHERE id = @id`
);

/**
 * Re-renders existing findings under the current detector and template versions,
 * keeping each one's id, slug, status and publication date.
 *
 * Article II says interpretation is versioned; that is only true if a published
 * conclusion can actually be rebuilt when the method improves. Without this, a
 * correction to a template reaches new findings only, and everything already
 * published silently keeps the reasoning of the day it was written.
 *
 * Reality is untouched. Claims are recomputed from scratch, and a finding whose
 * figures no longer verify is reported rather than quietly rewritten — a restate
 * that had to discard a check is a finding that needs a person, not a new
 * paragraph.
 */
export function restate({ siteId = SITE_ID, detectorId = null, verbose = false } = {}) {
  const candidates = detectAll(siteId);
  const result = { considered: 0, restated: 0, unmatched: 0, withdrawn: [], failed: [] };

  const existing = db
    .prepare(
      `SELECT id, slug, status, detectorId, subjectKey, windowStartMs
       FROM Finding WHERE siteId = ? AND origin = 'detector'
         AND (? IS NULL OR detectorId = ?)`
    )
    .all(siteId, detectorId, detectorId);

  for (const f of existing) {
    result.considered += 1;

    // Match on what the finding is about, not on its window: the window moves as
    // more arrives, and a restatement should follow the subject.
    const candidate = candidates.find(
      (c) => c.detectorId === f.detectorId && (c.subjectKey ?? null) === f.subjectKey
    );

    if (!candidate) {
      result.unmatched += 1;
      if (verbose) console.log(`[restate] no current candidate for ${f.slug}`);
      continue;
    }

    const drafted = render(candidate);
    if (!drafted) {
      result.unmatched += 1;
      continue;
    }

    dropClaims.run(f.id);
    const verdict = verifyFinding(f.id, candidate.claims ?? []);

    if (!verdict.ok) {
      result.failed.push({ slug: f.slug, reason: verdict.reason });
      if (verbose) console.log(`[restate] FAILED ${f.slug}: ${verdict.reason}`);
      continue;
    }

    const fields = {
      id: f.id,
      title: drafted.title,
      summary: drafted.summary,
      bodyHtml: drafted.body,
      detectorVersion: DETECTOR_VERSION,
      verifiedAt: verdict.checkedAt
    };

    // A method that got stricter has to reach what it already published, or the
    // gate only ever applied to whatever happened to arrive after it was written.
    //
    // This is the failure that made it necessary. On 2026-07-26 the pipeline
    // published three findings naming ClaudeBot, PerplexityBot and CCBot as
    // visitors. Every one of those requests came from a single address running a
    // secret-file scan under thirteen rotating crawler identities. The check that
    // would have held them was written four hours earlier and was sitting in the
    // working tree; restating under it corrected the wording and left all three
    // published, because status was the one field restatement would not touch.
    // Only a contradiction withdraws. Two things this deliberately does not do,
    // both of them mistakes made on the first attempt:
    //
    // It does not withdraw because the detector requires review. Those findings
    // were published by a person approving them, and treating a manual gate as a
    // reason to unpublish erases that approval — it withdrew a distributed-crawl
    // and an arrival-host finding that a human had read and accepted.
    //
    // It does not withdraw for trial overlap. "We asked Claude-User to read this
    // page, and it did" exists to disclose exactly that, and the overlap was
    // known when it was approved. Suppressing it would delete a disclosure that
    // was chosen over deletion once already.
    //
    // What withdraws is new evidence against a published claim: the vendor's own
    // list contradicting the identity, or the address turning out to be one that
    // presented several companies' crawler identities.
    if (f.status === "published" && candidate.contradicted) {
      const why = candidate.reviewReason ?? "new evidence contradicts what this finding states";

      withdrawFinding.run({ ...fields, reason: `WITHDRAWN BY RESTATE (${DETECTOR_VERSION}): ${why}` });
      result.withdrawn.push({ slug: f.slug, reason: why });
      if (verbose) console.log(`[restate] WITHDRAWN ${f.slug}: ${why}`);
      continue;
    }

    restateFinding.run(fields);

    result.restated += 1;
    if (verbose) console.log(`[restate] ${f.slug} -> ${DETECTOR_VERSION}`);
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
