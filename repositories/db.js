import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Absolute path: a relative one resolves against process.cwd() and silently
// creates an empty database when the process is launched from elsewhere.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const db = new Database(join(repoRoot, "agentshield.db"));

// WAL lets the public site process read while this one writes.
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

export default db;
