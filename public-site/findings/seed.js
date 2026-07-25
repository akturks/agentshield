import { randomUUID } from "node:crypto";
import db, { SITE_ID } from "../realityDb.js";
import { FINDINGS as HUMAN_FINDINGS } from "../pages/humanFindings.js";

// The three findings written by hand on 25 July 2026, moved into the store so
// that everything the site publishes lives in one place and renders through one
// path. They keep origin='human' because they were reasoned out by a person
// from the record rather than produced by a rule, and that difference is
// something a reader is entitled to see.

const exists = db.prepare("SELECT 1 FROM Finding WHERE slug = ?");

const insert = db.prepare(`
  INSERT INTO Finding (
    id, siteId, slug, detectorId, detectorVersion, origin, status,
    title, summary, bodyHtml, subjectKey, detectedAt, publishedAt, verifiedAt
  ) VALUES (
    @id, @siteId, @slug, 'human_analysis', 'n/a', 'human', 'published',
    @title, @summary, @bodyHtml, @subjectKey, @detectedAt, @publishedAt, @verifiedAt
  )
`);

export function seedHumanFindings() {
  let n = 0;
  for (const f of HUMAN_FINDINGS) {
    if (exists.get(f.slug)) continue;
    const at = `${f.date}T12:00:00.000Z`;
    insert.run({
      id: randomUUID(),
      siteId: SITE_ID,
      slug: f.slug,
      title: f.title,
      summary: f.summary,
      bodyHtml: f.body,
      subjectKey: f.id,
      detectedAt: at,
      publishedAt: at,
      verifiedAt: at
    });
    n += 1;
  }
  return n;
}
