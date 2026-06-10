import db from "./db.js";

export function findIdentityByFingerprint(fingerprint) {
  const stmt = db.prepare(`
    SELECT *
    FROM Identity
    WHERE fingerprint = ?
    LIMIT 1
  `);

  return stmt.get(fingerprint);
}

export function createIdentity({
  tenantId,
  fingerprint,
  identityType = "browser"
}) {
  const id = crypto.randomUUID();

  const stmt = db.prepare(`
    INSERT INTO Identity (
      id,
      fingerprint,
      identityType,
      tenantId,
      trustScore,
      firstSeenAt,
      lastSeenAt
    )
    VALUES (?, ?, ?, ?, 50, datetime('now'), datetime('now'))
  `);

  stmt.run(
    id,
    fingerprint,
    identityType,
    tenantId
  );

  return findIdentityByFingerprint(fingerprint);
}

export function findOrCreateIdentity({
  tenantId,
  fingerprint,
  identityType = "browser"
}) {
  let identity =
    findIdentityByFingerprint(fingerprint);

  if (!identity) {
    identity = createIdentity({
      tenantId,
      fingerprint,
      identityType
    });
  }

  return identity;
}
export function getIdentityById(
  identityId
) {
  return db.prepare(`
    SELECT *
    FROM Identity
    WHERE id = ?
    LIMIT 1
  `).get(identityId);
}
