#!/usr/bin/env node
import db from "./realityDb.js";
import { EXTERNAL, notOperator } from "./stats.js";

// Who arrived, and by which route we told them about it.
//
//   pnpm run arrivals            every route seen, newest activity first
//   pnpm run arrivals /audit     one path only
//
// A post carries a `?from=` tag and the query string is recorded verbatim in the
// reality layer, so attribution needs no redirect, no cookie and no script — and
// no route that varies its bytes by visitor, which Article V rules out anyway.
//
// The filter is imported rather than written here. Restating it by hand is how the
// home page came to say 89 external while the console said 170 for the same record,
// and the integrity check fails if that clause appears anywhere outside stats.js.
// This file counts what the site already counts.
//
// Nothing here decides whether an arrival was a person. The record has no column
// for that and a user agent is a claim, not an identity — so the agent string is
// printed and the reader draws their own conclusion.

const [, , pathFilter] = process.argv;

const byRoute = db.prepare(`
  SELECT
    COALESCE(
      NULLIF(TRIM(REPLACE(SUBSTR(query, INSTR(query, 'from=') + 5), '&', ' ')), ''),
      '(no tag)'
    ) AS tag,
    path,
    COUNT(*) AS hits,
    COUNT(DISTINCT cfConnectingIp) AS addresses,
    COUNT(DISTINCT userAgent) AS agents,
    MIN(observedAt) AS firstAt,
    MAX(observedAt) AS lastAt
  FROM RequestReality
  WHERE ${EXTERNAL}
    AND (? IS NULL OR path = ?)
  GROUP BY tag, path
  ORDER BY lastAt DESC
`);

const taggedAgents = db.prepare(`
  SELECT userAgent, COUNT(*) AS hits, cfIpCountry AS country, MAX(observedAt) AS lastAt
  FROM RequestReality
  WHERE ${EXTERNAL} AND query LIKE '%from=%'
    AND (? IS NULL OR path = ?)
  GROUP BY userAgent, cfIpCountry
  ORDER BY hits DESC, lastAt DESC
  LIMIT 20
`);

const operatorHits = db.prepare(`
  SELECT COUNT(*) AS n FROM RequestReality
  WHERE cfRay IS NOT NULL AND NOT (${notOperator()})
    AND (? IS NULL OR path = ?)
`);

const target = pathFilter ?? null;
const rows = byRoute.all(target, target);

console.log(
  `\nEXTERNAL ARRIVALS${target ? ` ON ${target}` : ""} — operator traffic excluded by the same rule the site publishes with\n`
);

if (rows.length === 0) {
  console.log("  nothing yet.\n");
} else {
  console.log(
    `  ${"tag".padEnd(18)}${"path".padEnd(22)}${"hits".padStart(5)}${"addr".padStart(6)}${"agents".padStart(8)}   last seen`
  );
  for (const r of rows) {
    console.log(
      `  ${r.tag.slice(0, 17).padEnd(18)}${r.path.slice(0, 21).padEnd(22)}${String(r.hits).padStart(5)}${String(r.addresses).padStart(6)}${String(r.agents).padStart(8)}   ${r.lastAt.slice(0, 16)}`
    );
  }
}

const agents = taggedAgents.all(target, target);
if (agents.length > 0) {
  console.log(`\n  WHO ARRIVED THROUGH A TAGGED LINK\n`);
  for (const a of agents) {
    console.log(
      `  ${String(a.hits).padStart(4)}  ${(a.country ?? "??").padEnd(4)} ${(a.userAgent ?? "(none)").slice(0, 88)}`
    );
  }
}

const ours = operatorHits.get(target, target).n;
console.log(
  `\n  ${ours} request(s) excluded as ours. Every figure above is external by the site's own definition.\n`
);
