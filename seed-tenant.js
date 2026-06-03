import Database from "better-sqlite3";

const db = new Database("agentshield.db");

db.prepare(`
  INSERT INTO Tenant (
    id,
    name,
    createdAt
  )
  VALUES (
    ?,
    ?,
    datetime('now')
  )
`).run(
  "tenant_1",
  "Demo Customer"
);

console.log("Tenant created");
