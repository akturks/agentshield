import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import migrate from "./migrate.js";

const here = dirname(fileURLToPath(import.meta.url));

// Separate file from agentshield.db on purpose: request reality has no foreign
// key into Tenant/Identity, so keeping it apart means the public process can
// never contend with or lock the private API's database.
const db = new Database(join(here, "..", "reality.db"));

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");

db.exec(readFileSync(join(here, "schema.sql"), "utf8"));

const { siteId, applied } = migrate(db);
if (applied.length > 0) console.log("[migrate]", applied.join(", "));

/** The site this process serves. Every write is scoped to it. */
export const SITE_ID = siteId;

export default db;
