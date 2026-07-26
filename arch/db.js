import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root, so scans and git commands resolve from one place. */
export const ROOT = join(here, "..");

const db = new Database(join(ROOT, "arch-reality.db"));

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");

db.exec(readFileSync(join(here, "schema.sql"), "utf8"));

export default db;
