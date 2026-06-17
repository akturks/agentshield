import db from "./db.js";

export function getSystemMode(
  tenantId
) {
  return db.prepare(`
    SELECT
      enforcementMode
    FROM Tenant
    WHERE id = ?
  `).get(
    tenantId
  );
}

export function setSystemMode(
  tenantId,
  enforcementMode
) {
  db.prepare(`
    UPDATE Tenant
    SET enforcementMode = ?
    WHERE id = ?
  `).run(
    enforcementMode,
    tenantId
  );

  return getSystemMode(
    tenantId
  );
}

