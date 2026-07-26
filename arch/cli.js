#!/usr/bin/env node
import { runOnce, restate, pending, published, approve, reject, ENGINE_VERSION } from "./engine.js";
import { claimsFor } from "./verifier.js";
import { scanRepository, latestScan } from "./scan.js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

//   node arch/cli.js scan             read the repository, record what is in it
//   node arch/cli.js run              scan, detect, verify, hold what survives
//   node arch/cli.js list             what is held and what is published
//   node arch/cli.js show <id>        one finding in full, with its figures
//   node arch/cli.js report [--write <path>]
//                                     every published finding as one markdown document
//   node arch/cli.js approve <id>
//   node arch/cli.js reject <id> [reason]
//   node arch/cli.js restate          rebuild findings against a fresh scan

const [, , cmd, ...args] = process.argv;
const short = (id) => id.slice(0, 8);

function find(id) {
  const all = [...pending(), ...published()];
  return all.find((f) => f.id.startsWith(id ?? ""));
}

switch (cmd) {
  case "scan": {
    const r = scanRepository({ verbose: true });
    console.log(`scan ${short(r.scanId)} · ${r.thresholdCount} threshold(s) in ${r.fileCount} file(s)`);
    break;
  }

  case "run": {
    const r = runOnce({ verbose: true });
    console.log(
      `\ndetected ${r.detected} · held for review ${r.held} · already known ${r.skipped} · failed verification ${r.failed.length}`
    );
    for (const f of r.failed) console.log(`  FAILED ${f.subjectKey}: ${f.reason}`);
    break;
  }

  case "restate": {
    const r = restate({ verbose: true });
    console.log(
      `\nconsidered ${r.considered} · restated ${r.restated} · no current candidate ${r.unmatched} · failed ${r.failed.length}`
    );
    break;
  }

  case "list": {
    const held = pending();
    const live = published();
    const scan = latestScan();
    if (scan) {
      console.log(
        `\nlast scan ${scan.commitSha.slice(0, 8)}${scan.dirty ? " (dirty)" : ""} · ${scan.scannedAt} · ${ENGINE_VERSION}`
      );
    }
    console.log(`\nHELD FOR REVIEW (${held.length})`);
    for (const f of held) console.log(`  ${short(f.id)}  ${f.title}`);
    console.log(`\nPUBLISHED (${live.length})`);
    for (const f of live) console.log(`  ${short(f.id)}  ${f.slug}`);
    if (held.length) console.log(`\napprove with: arch/cli.js approve <id>`);
    break;
  }

  case "show": {
    const f = find(args[0]);
    if (!f) { console.error("no finding matches that id"); process.exit(1); }
    console.log(`\n${f.title}\n${"=".repeat(Math.min(f.title.length, 100))}`);
    console.log(`status ${f.status} · verified ${f.verifiedAt ?? "never"}\n`);
    console.log(f.bodyMarkdown);
    console.log("\nFIGURES AS CHECKED");
    for (const c of claimsFor(f.id)) {
      console.log(`  [${c.ok ? "ok" : "MISMATCH"}] ${c.label}: expected ${c.expected}, observed ${c.observed}`);
      console.log(`         ${c.reproduceWith}`);
    }
    break;
  }

  case "report": {
    // Published findings, not held ones. A report is the reviewed output; the
    // queue is where a finding waits to become one, and printing both under one
    // heading would erase the distinction the review exists to make.
    const live = published();
    const scan = latestScan();
    const lines = [];

    lines.push(`# What this repository is, checked against what it says\n`);
    lines.push(
      `Repository at \`${scan?.commitSha?.slice(0, 8) ?? "unknown"}\`${
        scan?.dirty ? " with uncommitted changes at scan time" : ""
      }, scanned ${scan?.scannedAt ?? "never"}. Method version \`${ENGINE_VERSION}\`.\n`
    );
    lines.push(
      `${live.length} finding(s), each reviewed by a person before it appeared here. ` +
        `Every figure was recomputed by a second, independent route before it was written ` +
        `down, and each carries the command that reproduces it — so a reader who doubts a ` +
        `number does not have to take this document's word for it.\n`
    );

    for (const f of live) {
      lines.push(`\n---\n\n## ${f.title}\n`);
      lines.push(f.bodyMarkdown);
    }

    const text = lines.join("\n");
    const target = args[0] === "--write" ? args[1] : null;

    if (target) {
      // Written to a file and committed rather than rendered live. The artefact is
      // then versioned: what was found, and when, is in the history of one file
      // rather than in a database nobody else can read — which is the same claim
      // this tool makes about code, applied to its own output.
      writeFileSync(resolve(target), `${text}\n`, "utf8");
      console.log(`wrote ${target} · ${live.length} finding(s) · ${ENGINE_VERSION}`);
    } else {
      console.log(text);
    }
    break;
  }

  case "approve": {
    const f = pending().find((x) => x.id.startsWith(args[0] ?? ""));
    if (!f) { console.error("no held finding matches that id"); process.exit(1); }
    approve(f.id);
    console.log(`published: ${f.slug}`);
    break;
  }

  case "reject": {
    const f = pending().find((x) => x.id.startsWith(args[0] ?? ""));
    if (!f) { console.error("no held finding matches that id"); process.exit(1); }
    reject(f.id, args.slice(1).join(" "));
    console.log(`rejected: ${f.slug}`);
    break;
  }

  default:
    console.log(
      "usage: arch/cli.js scan|run|list|show <id>|report [--write <path>]|approve <id>|reject <id> [reason]|restate"
    );
}
