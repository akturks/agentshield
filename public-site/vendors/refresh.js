#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { VENDOR_LISTS } from "./sources.js";

// Captures every published range list into one dated file, which is then
// committed. Run by hand:
//
//   pnpm run vendors:refresh
//
// Deliberately not on a schedule and never called from the detector. A finding
// that verified an address must keep verifying it, and it cannot if the evidence
// is re-fetched underneath it. Updating the snapshot is an act with a date, like
// every other thing this project does to the world.
//
// The validation below is not defensive habit. One of these hosts answers a
// missing path with a styled HTML page and HTTP 200 — a fetcher that only
// checked the status code would have written an empty list and every agent
// behind it would have silently become "unlisted", which is this system
// accusing a client of spoofing because a documentation site changed its URLs.

const here = dirname(fileURLToPath(import.meta.url));

function parseList(body, url) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    const looksLikeHtml = /^\s*<!doctype html|^\s*<html/i.test(body);
    throw new Error(
      looksLikeHtml
        ? `${url} answered with an HTML page, not JSON — the path has probably moved`
        : `${url} answered with something that is not JSON`
    );
  }

  if (!Array.isArray(json.prefixes)) {
    throw new Error(`${url} returned JSON with no "prefixes" array`);
  }

  const prefixes = json.prefixes
    .map((p) => p.ipv4Prefix ?? p.ipv6Prefix)
    .filter((p) => typeof p === "string" && p.includes("/"));

  if (prefixes.length === 0) {
    throw new Error(`${url} returned a "prefixes" array holding no usable CIDR entries`);
  }

  return { prefixes, creationTime: json.creationTime ?? null };
}

const lists = {};
const failures = {};

for (const source of VENDOR_LISTS) {
  try {
    const response = await fetch(source.url, {
      redirect: "follow",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(`${source.url} answered HTTP ${response.status}`);
    }

    const { prefixes, creationTime } = parseList(await response.text(), source.url);

    lists[source.id] = {
      url: source.url,
      vendor: source.vendor,
      agents: source.agents,
      creationTime,
      fetchedAt: new Date().toISOString(),
      prefixes
    };

    console.log(`  ok    ${source.id.padEnd(26)} ${String(prefixes.length).padStart(5)} prefixes`);
  } catch (err) {
    failures[source.id] = err.message;
    console.log(`  FAIL  ${source.id.padEnd(26)} ${err.message}`);
  }
}

if (Object.keys(lists).length === 0) {
  console.error("\nNo list could be captured. Refusing to write an empty snapshot.");
  process.exit(1);
}

const capturedAt = new Date().toISOString();
const file = `snapshot-${capturedAt.slice(0, 10)}.json`;

writeFileSync(
  join(here, file),
  `${JSON.stringify({ capturedAt, lists, failures }, null, 2)}\n`
);

console.log(`\nwrote ${file} · ${Object.keys(lists).length} list(s), ${Object.keys(failures).length} failure(s)`);
console.log("Commit it: the snapshot is the evidence a published verification rests on.");
