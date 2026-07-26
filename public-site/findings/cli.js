#!/usr/bin/env node
import { runOnce, restate, published, pending, approve, reject } from "./engine.js";
import { claimsFor, recheck } from "./verifier.js";
import { seedHumanFindings } from "./seed.js";

// Operator interface for the findings pipeline.
//
//   node public-site/findings/cli.js run       detect, verify, publish or hold
//   node public-site/findings/cli.js list      what is published and what waits
//   node public-site/findings/cli.js show <id> a finding with every checked figure
//   node public-site/findings/cli.js approve <id>
//   node public-site/findings/cli.js reject <id> [reason]
//   node public-site/findings/cli.js recheck   do published figures still hold
//   node public-site/findings/cli.js restate [detectorId]
//                                             re-render findings under the
//                                             current method version, keeping
//                                             their URLs and publication dates
//   node public-site/findings/cli.js seed      load the hand-written findings

const [, , cmd, ...args] = process.argv;

function short(id) {
  return id.slice(0, 8);
}

switch (cmd) {
  case "run": {
    const r = runOnce({ verbose: true });
    console.log(
      `\ndetected ${r.detected} · published ${r.published} · held ${r.pending} · rejected ${r.rejected} · already known ${r.skipped}`
    );
    break;
  }

  case "restate": {
    const r = restate({ detectorId: args[0] ?? null, verbose: true });
    console.log(
      `\nconsidered ${r.considered} · restated ${r.restated} · no current candidate ${r.unmatched} · failed verification ${r.failed.length}`
    );
    for (const f of r.failed) console.log(`  FAILED ${f.slug}: ${f.reason}`);
    break;
  }

  case "seed": {
    const n = seedHumanFindings();
    console.log(n === 0 ? "hand-written findings already present" : `seeded ${n} hand-written finding(s)`);
    break;
  }

  case "list": {
    const pub = published();
    const held = pending();
    console.log(`\nPUBLISHED (${pub.length})`);
    for (const f of pub) {
      console.log(`  ${short(f.id)}  ${f.origin.padEnd(8)} ${f.slug}`);
    }
    console.log(`\nHELD FOR REVIEW (${held.length})`);
    for (const f of held) {
      console.log(`  ${short(f.id)}  ${f.detectorId.padEnd(24)} ${f.title}`);
    }
    if (held.length) console.log(`\napprove with: cli.js approve <id>`);
    break;
  }

  case "show": {
    const all = [...published(), ...pending()];
    const f = all.find((x) => x.id.startsWith(args[0] ?? ""));
    if (!f) {
      console.error("no finding matches that id");
      process.exit(1);
    }
    console.log(`\n${f.title}\n${"=".repeat(f.title.length)}`);
    console.log(`status ${f.status} · origin ${f.origin} · detector ${f.detectorId}`);
    console.log(`\n${f.summary}\n`);
    console.log("VERIFIED FIGURES");
    for (const c of claimsFor(f.id)) {
      console.log(`  [${c.ok ? "ok" : "MISMATCH"}] ${c.label}: expected ${c.expected}, observed ${c.observed}`);
    }
    break;
  }

  case "approve": {
    if (!args[0]) { console.error("usage: approve <id>"); process.exit(1); }
    const f = pending().find((x) => x.id.startsWith(args[0]));
    if (!f) { console.error("no held finding matches that id"); process.exit(1); }
    approve(f.id);
    console.log(`published: ${f.slug}`);
    break;
  }

  case "reject": {
    if (!args[0]) { console.error("usage: reject <id> [reason]"); process.exit(1); }
    const f = pending().find((x) => x.id.startsWith(args[0]));
    if (!f) { console.error("no held finding matches that id"); process.exit(1); }
    reject(f.id, args.slice(1).join(" "));
    console.log(`rejected: ${f.slug}`);
    break;
  }

  case "recheck": {
    for (const f of published()) {
      const results = recheck(f.id);
      const drifted = results.filter((r) => !r.stillAccurate);
      if (drifted.length === 0) {
        console.log(`ok      ${f.slug}`);
      } else {
        console.log(`DRIFTED ${f.slug}`);
        for (const d of drifted) {
          console.log(`          ${d.label}: published ${d.expected}, now ${d.observedNow}`);
        }
      }
    }
    console.log(
      "\nDrift on an open window is expected — the record grew. It means the sentence has aged, not that it was wrong."
    );
    break;
  }

  default:
    console.log(
      "usage: cli.js run|seed|list|show <id>|approve <id>|reject <id>|recheck|restate [detectorId]"
    );
}
