import { randomUUID } from "node:crypto";
import db from "./db.js";
import { detectAll, DETECTOR_VERSION } from "./detectors.js";
import { render, TEMPLATE_VERSION } from "./templates.js";
import { verifyFinding, VERIFIER_VERSION } from "./verifier.js";
import { scanRepository, latestScan, SCANNER_VERSION } from "./scan.js";

// detect → draft → verify → hold or publish, the same order as the observatory.
//
// Nothing publishes itself here. Every finding this detector produces implies
// something about intent — that two files were meant to agree, or were not — and
// the counts cannot settle it. The observatory auto-publishes findings that are a
// direct restatement of a count; this one has none of those yet.

export const ENGINE_VERSION = `${SCANNER_VERSION}/${DETECTOR_VERSION}/${TEMPLATE_VERSION}/${VERIFIER_VERSION}`;

const findExisting = db.prepare(
  "SELECT id, status FROM ArchFinding WHERE detectorId = ? AND subjectKey IS ?"
);

const insertFinding = db.prepare(`
  INSERT INTO ArchFinding (
    id, slug, detectorId, detectorVersion, status, subjectKey,
    title, summary, bodyMarkdown, scanId, detectedAt
  ) VALUES (
    @id, @slug, @detectorId, @detectorVersion, @status, @subjectKey,
    @title, @summary, @bodyMarkdown, @scanId, @detectedAt
  )
`);

const restateFinding = db.prepare(`
  UPDATE ArchFinding
     SET title = @title, summary = @summary, bodyMarkdown = @bodyMarkdown,
         detectorVersion = @detectorVersion, scanId = @scanId, verifiedAt = @verifiedAt
   WHERE id = @id
`);

const setStatus = db.prepare(
  "UPDATE ArchFinding SET status = ?, verifiedAt = ?, publishedAt = ?, rejectedReason = ? WHERE id = ?"
);

const dropClaims = db.prepare("DELETE FROM ArchFindingClaim WHERE findingId = ?");
const dropFinding = db.prepare("DELETE FROM ArchFinding WHERE id = ?");
const slugTaken = db.prepare("SELECT 1 FROM ArchFinding WHERE slug = ? AND id != ?");

function uniqueSlug(slug, id) {
  let candidate = slug;
  let n = 2;
  while (slugTaken.get(candidate, id)) candidate = `${slug}-${n++}`;
  return candidate;
}

/**
 * Scans, detects, verifies, and holds what survives.
 *
 * A candidate whose figures do not reproduce is deleted rather than stored as a
 * draft: an unverified finding sitting in the table is one someone will eventually
 * read as a finding.
 */
export function runOnce({ rescan = true, verbose = false } = {}) {
  const scan = rescan ? scanRepository({ verbose }) : { scanId: latestScan()?.id };
  if (!scan.scanId) throw new Error("no scan to work from — run with rescan");

  const result = { detected: 0, held: 0, skipped: 0, failed: [] };

  for (const candidate of detectAll(scan.scanId)) {
    result.detected += 1;

    if (findExisting.get(candidate.detectorId, candidate.subjectKey ?? null)) {
      result.skipped += 1;
      continue;
    }

    const drafted = render(candidate);
    if (!drafted) {
      result.skipped += 1;
      continue;
    }

    const id = randomUUID();
    insertFinding.run({
      id,
      slug: uniqueSlug(drafted.slug, id),
      detectorId: candidate.detectorId,
      detectorVersion: DETECTOR_VERSION,
      status: "pending",
      subjectKey: candidate.subjectKey ?? null,
      title: drafted.title,
      summary: drafted.summary,
      bodyMarkdown: drafted.body,
      scanId: scan.scanId,
      detectedAt: new Date().toISOString()
    });

    const verdict = verifyFinding(id, candidate.claims ?? []);
    if (!verdict.ok) {
      dropClaims.run(id);
      dropFinding.run(id);
      result.failed.push({ subjectKey: candidate.subjectKey, reason: verdict.reason });
      if (verbose) console.log(`[arch] FAILED ${candidate.subjectKey}: ${verdict.reason}`);
      continue;
    }

    setStatus.run("pending", verdict.checkedAt, null, null, id);
    result.held += 1;
    if (verbose) console.log(`[arch] held for review: ${drafted.title}`);
  }

  return result;
}

/**
 * Re-renders existing findings against a fresh scan, keeping their identity.
 *
 * Same contract as the observatory's restate: the id, the slug and the publication
 * date survive, the prose and the figures are rebuilt. Improving the detector must
 * not mean abandoning what it already reported.
 */
export function restate({ verbose = false } = {}) {
  const scan = scanRepository({ verbose });
  const candidates = detectAll(scan.scanId);
  const result = { considered: 0, restated: 0, unmatched: 0, failed: [] };

  for (const finding of db.prepare("SELECT id, slug, subjectKey, detectorId FROM ArchFinding").all()) {
    result.considered += 1;
    const candidate = candidates.find(
      (c) => c.detectorId === finding.detectorId && (c.subjectKey ?? null) === finding.subjectKey
    );

    if (!candidate) {
      result.unmatched += 1;
      if (verbose) console.log(`[arch] no current candidate for ${finding.slug}`);
      continue;
    }

    const drafted = render(candidate);
    if (!drafted) {
      result.unmatched += 1;
      continue;
    }

    dropClaims.run(finding.id);
    const verdict = verifyFinding(finding.id, candidate.claims ?? []);
    if (!verdict.ok) {
      result.failed.push({ slug: finding.slug, reason: verdict.reason });
      continue;
    }

    restateFinding.run({
      id: finding.id,
      title: drafted.title,
      summary: drafted.summary,
      bodyMarkdown: drafted.body,
      detectorVersion: DETECTOR_VERSION,
      scanId: scan.scanId,
      verifiedAt: verdict.checkedAt
    });
    result.restated += 1;
    if (verbose) console.log(`[arch] restated ${finding.slug} -> ${DETECTOR_VERSION}`);
  }

  return result;
}

const listByStatus = db.prepare(
  `SELECT id, slug, detectorId, status, title, summary, bodyMarkdown, detectedAt, verifiedAt, publishedAt
   FROM ArchFinding WHERE status = ? ORDER BY COALESCE(publishedAt, detectedAt) DESC`
);

export const pending = () => listByStatus.all("pending");
export const published = () => listByStatus.all("published");

export function approve(id) {
  const now = new Date().toISOString();
  setStatus.run("published", now, now, null, id);
}

export function reject(id, reason = "") {
  setStatus.run("rejected", new Date().toISOString(), null, reason || null, id);
}
