import { execFileSync } from "node:child_process";
import { ROOT } from "./db.js";

// What this tool wrote, so it can be told apart from what the project wrote.
//
// The observatory has an article forbidding the ACTION layer from being cited as
// evidence, and it is enforced by a check. This pipeline was built without an ACTION
// layer on the grounds that it reads a repository and does nothing to it — and then it
// grew one anyway, quietly, the first time a report was written into `docs/` and
// committed.
//
// The consequence was immediate and would have gone unnoticed. One figure in every
// unimported-module finding counts how many Markdown files describe the module by name;
// the report names every module it reports; so publishing it raised `src/services` from
// 2 documented to 9, and `repositories` from 0 to 5, on the next run. Every one of those
// nine is "documented" by the document claiming they are undocumented.
//
// Recognised by a marker the report writes into itself rather than by a hard-coded path,
// because the path is a command-line argument and a rule that only works for one value
// of it is a rule waiting to be wrong.

export const GENERATED_MARKER = "<!-- generated-by: arch -->";

let cache = null;

/**
 * Every Markdown file in the repository that this tool produced.
 *
 * Computed once per process. The alternative — testing each candidate as it comes up —
 * reads the same files repeatedly during a run over a large repository, and the set
 * cannot change while the process is alive.
 */
export function generatedDocs() {
  if (cache !== null) return cache;
  try {
    const out = execFileSync("git", ["grep", "-l", "-F", GENERATED_MARKER, "--", "*.md"], {
      cwd: ROOT,
      encoding: "utf8"
    });
    cache = new Set(out.split("\n").filter(Boolean));
  } catch (err) {
    // Exit 1 from git grep means nothing matched: no report has been written here yet.
    if (err.status === 1) cache = new Set();
    else throw err;
  }
  return cache;
}

/** Whether this path is a document this tool wrote. */
export function isGeneratedDoc(path) {
  return generatedDocs().has(path);
}
