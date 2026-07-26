import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const home = join(here, "..");

/**
 * The repository being read. Defaults to the one this tool lives in.
 *
 * Every finding so far is about code written by one person with one set of habits,
 * because the tool has only ever been pointed at itself. That is the largest
 * untested assumption in it: whether the detector finds real things in a codebase
 * it did not grow up in, finds nothing, or drowns the reader in noise. None of
 * those is knowable from here, so the target is a parameter.
 */
export const ROOT = resolve(process.env.ARCH_REPO ?? home);

/**
 * One database per repository, never shared.
 *
 * Findings are identified by what they are about — an expression and a set of
 * files — and two repositories can easily hold the same expression in the same
 * file names. Sharing a database would silently merge them and the tool would
 * report a duplicate across two projects as though it were one. A separate file
 * makes that impossible rather than unlikely.
 */
const DB_PATH = process.env.ARCH_DB
  ? resolve(process.env.ARCH_DB)
  : join(home, "arch-reality.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("synchronous = NORMAL");

db.exec(readFileSync(join(here, "schema.sql"), "utf8"));

export { DB_PATH };
export default db;
