import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The declared population, and the rule that drew a sample from it.
//
// Both are committed, dated files rather than something fetched when the survey
// runs — the same discipline as `vendors/`. A percentage is a statement about a
// population, so a survey whose population is assembled at run time is a
// percentage nobody can check: it would be computed over a list that has since
// moved, with no way to tell what it was on the day.
//
// The sample rule is mechanical on purpose. Every judgement about which domains
// belong in it is a judgement about what the answer should be, and the point of
// measuring is to not have made that judgement. So: a fixed stride over a
// published ranking, no seed, no exclusions. Domains that turn out to be
// infrastructure and serve no site are kept and reported as what they are,
// because deciding which of them counts as "a website" is exactly the choice
// this rule exists to avoid.

const here = dirname(fileURLToPath(import.meta.url));

function newest() {
  const files = readdirSync(here)
    .filter((f) => /^population-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (files.length === 0) throw new Error("survey: no population snapshot committed");
  return files[files.length - 1];
}

const file = newest();
const snapshot = JSON.parse(readFileSync(join(here, file), "utf8"));

export const POPULATION = Object.freeze({
  id: snapshot.populationId,
  url: snapshot.populationUrl,
  note: snapshot.populationNote,
  drawnAt: snapshot.drawnAt,
  rule: snapshot.sampleRule,
  size: snapshot.sampleSize,
  file
});

/** The drawn sample, in rank order. A copy — callers must not mutate it. */
export function sample() {
  return snapshot.domains.map((d) => ({ ...d }));
}
