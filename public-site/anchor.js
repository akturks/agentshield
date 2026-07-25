import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// Writes the observatory's decision trail into Project Anchor.
//
// Anchor is not the findings engine and cannot be — its extractors parse
// decision markdown, not HTTP records. What it is good for is the thing that
// went missing in this repository before: why a call was made. Every
// publication, rejection and detector change lands here as a session file, so
// six months from now "why is this finding not on the site" has an answer that
// does not depend on anyone remembering.
//
// Coupling is deliberately loose. Nothing here reads Anchor's database or
// imports its code; it drops a file in the directory Anchor already watches,
// and `multi ingest` picks it up on its own schedule. A failure to record a
// decision must never stop the pipeline that made it.

const ANCHOR_WATCH =
  process.env.ANCHOR_WATCH_PATH ??
  "/Users/serdar/projects/multi/project-anchor/watch";

const ENABLED = process.env.ANCHOR_DISABLED !== "1";

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Appends one decision to Anchor's watch directory.
 *
 * Field names match what Anchor's extractors already look for, so these files
 * are ordinary sessions to it rather than a special case.
 */
export function recordDecision({ question, decision, reason, outcome, tag }) {
  if (!ENABLED) return null;

  try {
    if (!existsSync(ANCHOR_WATCH)) mkdirSync(ANCHOR_WATCH, { recursive: true });

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `observatory-${stamp}-${slugify(tag ?? decision)}.md`;

    const body = `# Observatory ${now.toISOString().slice(0, 19)}Z

Soru:

${question}

Karar:

${decision}

Gerekçe:

${reason}

Sonuç:

${outcome}
`;

    writeFileSync(join(ANCHOR_WATCH, filename), body, "utf8");
    return filename;
  } catch (err) {
    // Losing the trail is bad; losing the pipeline is worse.
    console.error("[anchor] could not record decision:", err.message);
    return null;
  }
}

export function recordPublication(finding, { automatic }) {
  return recordDecision({
    tag: `publish-${finding.slug ?? finding.detectorId}`,
    question: `Should the finding "${finding.title}" be published?`,
    decision: automatic
      ? `Published automatically. Detector ${finding.detectorId} matched and every figure it asserted was recomputed from the record and matched.`
      : `Published after review. Detector ${finding.detectorId} produced it; a person read it before it went live.`,
    reason: automatic
      ? `${finding.detectorId} is on the auto-publish list because its output restates a count rather than implying anything about intent or identity. The verifier confirmed each figure against RequestReality, and a mismatch would have discarded the draft.`
      : `${finding.detectorId} is held for review by policy: it says something unflattering about a named actor, where a wrong finding costs more than a missing one.`,
    outcome: `Live at /findings/${finding.slug}. Figures were verified at publication; an open window means they may drift as the record grows, which ages the sentence rather than falsifying it.`
  });
}

export function recordRejection(finding, reason) {
  return recordDecision({
    tag: `reject-${finding.slug ?? finding.detectorId}`,
    question: `Should the finding "${finding.title}" be published?`,
    decision: `Rejected. Not published.`,
    reason: reason || "No reason recorded.",
    outcome: `The finding stays in the store with status 'rejected' so the decision is auditable. If the same detector matches the same subject and window again, it will not be re-raised.`
  });
}

export function recordDetectorChange({ detectorId, version, what, why }) {
  return recordDecision({
    tag: `detector-${detectorId}-${version}`,
    question: `Why was detector ${detectorId} changed to ${version}?`,
    decision: what,
    reason: why,
    outcome: `Findings already published by the previous version are not rewritten. Re-running detection produces the new reading over the same untouched reality, which is the replay guarantee in docs/CONSTITUTION.md.`
  });
}
