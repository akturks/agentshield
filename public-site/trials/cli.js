#!/usr/bin/env node
import { SITE_ORIGIN } from "../layout.js";
import {
  startTrial,
  recordReply,
  trials,
  trial,
  outcome,
  comparison,
  DEFAULT_WINDOW_MS
} from "./trials.js";

//   cli.js start <vendor> <path> ["prompt"]   register a trial, then go run it
//   cli.js watch <id>                         poll until something arrives
//   cli.js show <id>                          what arrived in the window
//   cli.js reply <id> "what it answered"      record the assistant's answer
//   cli.js compare                            the cross-vendor table
//   cli.js list

const [, , cmd, ...args] = process.argv;

const DEFAULT_PROMPT = (path) =>
  `Do not search. Use your browsing tool to open this exact URL directly: ${SITE_ORIGIN}${path}\n` +
  `Then tell me the "Reality marker" string printed at the bottom of that page.`;

const yn = (v) => (v ? "yes" : "no");

function printOutcome(o) {
  const t = o.trial;
  console.log(`\n${t.vendor} → ${t.targetPath}`);
  console.log(`started ${t.startedAt.slice(0, 19).replace("T", " ")} UTC, window ${t.windowMs / 60000} min`);
  console.log(`\n  fetched the target page   ${yn(o.fetchedTarget)}${o.targetFetches > 1 ? ` (${o.targetFetches}×)` : ""}`);
  console.log(`  requested robots.txt      ${yn(o.requestedRobots)}${o.readRobotsFirst ? " (before the target)" : ""}`);
  console.log(`  executed JavaScript       ${yn(o.executedJs)}`);
  console.log(`  distinct paths taken      ${o.pathsTaken}`);
  console.log(`  distinct addresses        ${o.distinctAddresses}`);
  console.log(
    `  time to first request     ${o.latencyMs === null ? "— nothing arrived" : `${(o.latencyMs / 1000).toFixed(1)} s`}`
  );
  if (o.declaredAgents.length) {
    console.log(`  declared                  ${o.declaredAgents.map((a) => a.slice(0, 60)).join("\n                            ")}`);
  }
  if (o.countries.length) console.log(`  from                      ${o.countries.join(", ")}`);
  if (t.reply) console.log(`\n  assistant answered: ${t.reply.slice(0, 140)}`);
  if (!o.fetchedTarget && o.requests.length === 0) {
    console.log(
      `\n  Nothing arrived. That is a result: the assistant did not fetch the page.\n` +
        `  Whether it searched instead is not observable from here.`
    );
  }
}

switch (cmd) {
  case "start": {
    const [vendor, path] = args;
    if (!vendor || !path) {
      console.error('usage: start <vendor> <path> ["prompt"]');
      process.exit(1);
    }
    const prompt = args[2] || DEFAULT_PROMPT(path);
    const { id, startedAt } = startTrial({ vendor, prompt, targetPath: path });
    console.log(`\ntrial ${id.slice(0, 8)} registered at ${startedAt.slice(11, 19)} UTC`);
    console.log(`window: ${DEFAULT_WINDOW_MS / 60000} minutes\n`);
    console.log("Now paste this into " + vendor + ":\n");
    console.log("─".repeat(72));
    console.log(prompt);
    console.log("─".repeat(72));
    console.log(`\nThen:  node public-site/trials/cli.js watch ${id.slice(0, 8)}`);
    break;
  }

  case "watch": {
    const t = trials().find((x) => x.id.startsWith(args[0] ?? ""));
    if (!t) { console.error("no trial matches that id"); process.exit(1); }
    const deadline = t.startedAtMs + t.windowMs;
    console.log(`watching ${t.vendor} → ${t.targetPath} …`);
    let seen = 0;
    while (Date.now() < deadline) {
      const o = outcome(t.id);
      if (o.requests.length > seen) {
        for (const r of o.requests.slice(seen)) {
          console.log(
            `  ${r.observedAt.slice(11, 19)}  ${String(r.responseStatus).padEnd(4)} ${r.path.padEnd(28)} ${(r.userAgent ?? "").slice(0, 46)}`
          );
        }
        seen = o.requests.length;
      }
      if (o.fetchedTarget) break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    printOutcome(outcome(t.id));
    break;
  }

  case "show": {
    const t = trials().find((x) => x.id.startsWith(args[0] ?? ""));
    if (!t) { console.error("no trial matches that id"); process.exit(1); }
    printOutcome(outcome(t.id));
    break;
  }

  case "reply": {
    const t = trials().find((x) => x.id.startsWith(args[0] ?? ""));
    if (!t) { console.error("no trial matches that id"); process.exit(1); }
    recordReply(t.id, args.slice(1).join(" "));
    console.log("recorded");
    break;
  }

  case "compare": {
    const rows = comparison();
    if (rows.length === 0) { console.log("no trials yet"); break; }
    console.log(
      "\nvendor          target                fetched  robots  robots-first  js   paths  latency"
    );
    for (const o of rows) {
      console.log(
        `${o.trial.vendor.padEnd(15)} ${o.trial.targetPath.slice(0, 20).padEnd(21)} ` +
          `${yn(o.fetchedTarget).padEnd(8)} ${yn(o.requestedRobots).padEnd(7)} ` +
          `${yn(o.readRobotsFirst).padEnd(13)} ${yn(o.executedJs).padEnd(4)} ` +
          `${String(o.pathsTaken).padEnd(6)} ${o.latencyMs === null ? "—" : `${(o.latencyMs / 1000).toFixed(1)}s`}`
      );
    }
    console.log(
      "\nAttribution is by time window: a request that arrived while a trial was open.\n" +
        "An unrelated crawler passing through lands in the same bucket, which is why the\n" +
        "distinct-address count is kept per trial. Correlation, not causation."
    );
    break;
  }

  case "list":
    for (const t of trials()) {
      console.log(
        `${t.id.slice(0, 8)}  ${t.startedAt.slice(5, 16).replace("T", " ")}  ${t.vendor.padEnd(14)} ${t.targetPath}`
      );
    }
    break;

  default:
    console.log("usage: cli.js start|watch|show|reply|compare|list");
}
