// Runs the checks nobody was running.
//
// epistemicIntegrity() and recheck() were only ever evaluated when a person
// loaded the console. That is the wrong trigger for the two questions they
// answer — "is the separation still holding" and "do the published figures
// still hold" — because both can start being wrong at any moment and neither
// announces itself. The rate limit on this site was inverted from the day it
// was written and 190 tests stayed green over it.
//
// Scheduled from launchd rather than a setInterval inside the server, and the
// distinction matters here: this process restarts often — five times on 28 July
// alone — and a 24-hour timer inside it resets on every restart. A daily check
// wired that way can go months without firing while appearing to be configured.
// launchd owns the clock, survives restarts, and catches up after a reboot.
//
// The result is written to a file rather than only logged. The console reads
// that file, so a failure keeps showing even when nothing has recomputed it,
// and a check that stopped running at all is visible as a stale timestamp
// instead of looking identical to a check that passed.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { epistemicIntegrity } from "../integrity.js";
import { recheck } from "../findings/verifier.js";
import { published } from "../findings/engine.js";

export const STAMP_PATH = new URL("../logs/integrity-stamp.json", import.meta.url).pathname;

export function runWatch() {
  const at = new Date().toISOString();

  const integrity = epistemicIntegrity();
  const failed = integrity.checks.filter((c) => !c.ok);

  // Drift is not a failure. The record grows, so a figure published against an
  // open window ages — the site says so itself. What is reported here is the
  // count, so a sudden jump is visible, and the slugs, so it can be looked at.
  const all = published();
  const drifted = all
    .map((f) => ({ slug: f.slug, drifted: recheck(f.id).filter((r) => !r.stillAccurate) }))
    .filter((r) => r.drifted.length > 0);

  const stamp = {
    at,
    ok: failed.length === 0,
    integrity: {
      ok: integrity.ok,
      checks: integrity.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
      failed: failed.map((c) => `${c.name} — ${c.detail}`)
    },
    findings: {
      checked: all.length,
      drifted: drifted.length,
      slugs: drifted.map((r) => r.slug)
    }
  };

  mkdirSync(dirname(STAMP_PATH), { recursive: true });
  writeFileSync(STAMP_PATH, JSON.stringify(stamp, null, 2));
  return stamp;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());

if (invokedDirectly) {
  const stamp = runWatch();
  console.log(`[integrity-watch] ${stamp.at}`);
  for (const c of stamp.integrity.checks) console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}`);
  console.log(
    `  ${stamp.findings.drifted} of ${stamp.findings.checked} published findings have drifted${
      stamp.findings.slugs.length ? `: ${stamp.findings.slugs.join(", ")}` : ""
    }`
  );
  if (!stamp.ok) {
    console.error("\nINTEGRITY BROKEN:");
    for (const f of stamp.integrity.failed) console.error(`  ${f}`);
    process.exit(1);
  }
}
