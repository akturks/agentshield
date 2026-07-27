import { randomUUID } from "node:crypto";

// Idempotent migrations, run on every boot. Reality rows are never rewritten in
// place except to backfill the siteId they always implicitly had — the host
// header was recorded from the first request, so nothing is being invented.

export const PRIMARY_HOSTNAME =
  process.env.PRIMARY_HOSTNAME ?? "agentshieldaidefense.com";

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
}

function addColumn(db, table, name, decl) {
  if (columns(db, table).has(name)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
  return true;
}

export default function migrate(db) {
  const applied = [];

  // 1. siteId on every reality table.
  for (const table of ["RequestReality", "CanaryToken", "JsExecution"]) {
    if (addColumn(db, table, "siteId", "TEXT")) applied.push(`${table}.siteId`);
  }

  // 2. Register the primary site, then backfill.
  let site = db
    .prepare("SELECT id FROM Site WHERE hostname = ?")
    .get(PRIMARY_HOSTNAME);

  if (!site) {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO Site (id, hostname, label, addedAt, active) VALUES (?, ?, ?, ?, 1)"
    ).run(id, PRIMARY_HOSTNAME, "AgentShield Observatory", new Date().toISOString());
    site = { id };
    applied.push(`site:${PRIMARY_HOSTNAME}`);
  }

  // Rows predating the column belong to the only site that existed. Match on
  // the recorded host where present so a future second site is never absorbed
  // into the first by accident.
  const backfilled = db
    .prepare(
      `UPDATE RequestReality SET siteId = ?
       WHERE siteId IS NULL AND (host IS NULL OR host LIKE ?)`
    )
    .run(site.id, `%${PRIMARY_HOSTNAME}`).changes;

  if (backfilled) applied.push(`backfill RequestReality:${backfilled}`);

  for (const table of ["CanaryToken", "JsExecution"]) {
    const n = db
      .prepare(`UPDATE ${table} SET siteId = ? WHERE siteId IS NULL`)
      .run(site.id).changes;
    if (n) applied.push(`backfill ${table}:${n}`);
  }

  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_rr_site ON RequestReality(siteId, observedAtMs)"
  );

  // 3. When a conclusion stopped being published.
  //
  // The table recorded publishedAt and a reason but never the moment a finding
  // came down, which made every withdrawal an undated one. Seven findings were
  // live and then removed on 26–27 July and the site could say why but not when.
  //
  // Deliberately not backfilled. Those seven rejections happened before the
  // column existed and the instant is genuinely unknown; writing today's date
  // into them would invent a fact to fill a gap, and the page states "not
  // recorded" for exactly the rows where that is the truth.
  if (addColumn(db, "Finding", "rejectedAt", "TEXT")) applied.push("Finding.rejectedAt");

  return { siteId: site.id, applied };
}
