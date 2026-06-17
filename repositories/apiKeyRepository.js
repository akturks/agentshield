import db from "./db.js";

export function getTenantByApiKey(
  apiKey
) {
  return db.prepare(`
    SELECT
      t.id               AS tenantId,
      t.name             AS name,
      t.enforcementMode  AS enforcementMode
    FROM ApiKey a
    JOIN Tenant t
      ON a.tenantId = t.id
    WHERE a.key = ?
    LIMIT 1
  `).get(apiKey);
}
