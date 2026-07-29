#!/usr/bin/env node
import Database from "better-sqlite3";

// Enough to answer the first questions from the record alone, on a machine that
// has nothing else installed.
//
// What this deliberately does not do is tell you that GPTBot visited your site.
// It can tell you that requests *declaring* GPTBot arrived, which is a different
// statement, and the difference is the whole subject. A user agent is a string
// the sender chose. Establishing whether the sender was who it said requires
// checking the connecting address against the list that vendor publishes, and
// that check needs those lists — see `corroboration` below.

const [, , cmd = "summary", ...rest] = process.argv;
const file = process.env.RECORD_FILE ?? rest.find((a) => a.endsWith(".db")) ?? "./record.db";

let db;
try {
  db = new Database(file, { readonly: true });
} catch {
  console.error(`cannot open ${file} — pass a path or set RECORD_FILE`);
  process.exit(1);
}

const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => Object.values(db.prepare(sql).get(...p) ?? {})[0];

// Agents that describe themselves as automated readers of the web. Matching is
// on the declared string only.
const AI = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User",
  "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Perplexity-User",
  "Google-Extended", "GoogleOther", "Applebot-Extended", "CCBot",
  "meta-externalagent", "Amazonbot", "Bytespider", "cohere-ai", "Diffbot",
  "YouBot", "Timpibot", "xAI-SearchBot", "DeepSeekBot"
];
const aiWhere = AI.map(() => "userAgent LIKE ?").join(" OR ");
const aiParams = AI.map((a) => `%${a}%`);

const RULES = "('/robots.txt','/sitemap.xml','/llms.txt','/ai.txt')";

function summary() {
  console.log(`record: ${file}\n`);
  console.log(`requests            ${one("SELECT COUNT(*) FROM RequestReality")}`);
  console.log(`first               ${one("SELECT MIN(observedAt) FROM RequestReality") ?? "—"}`);
  console.log(`last                ${one("SELECT MAX(observedAt) FROM RequestReality") ?? "—"}`);
  console.log(`distinct addresses  ${one("SELECT COUNT(DISTINCT cfConnectingIp) FROM RequestReality")}`);
  console.log(`distinct agents     ${one("SELECT COUNT(DISTINCT userAgent) FROM RequestReality")}`);
  console.log(`declaring an AI     ${one(`SELECT COUNT(*) FROM RequestReality WHERE ${aiWhere}`, ...aiParams)}`);
  console.log(`answered 4xx/5xx    ${one("SELECT COUNT(*) FROM RequestReality WHERE responseStatus >= 400")}`);
}

function agents() {
  console.log("Requests grouped by the identity they declared. A declaration is");
  console.log("not an identity — see `corroboration`.\n");
  console.table(
    all(
      `SELECT substr(userAgent, 1, 52) AS declared, COUNT(*) AS requests,
              COUNT(DISTINCT cfConnectingIp) AS addresses,
              COUNT(DISTINCT path) AS paths,
              MAX(observedAt) AS last
       FROM RequestReality WHERE userAgent IS NOT NULL
       GROUP BY declared ORDER BY requests DESC LIMIT 25`
    )
  );
}

/**
 * The question a site owner is actually asking, phrased so the answer means
 * something: of the requests declaring an AI reader, how many asked for a page
 * rather than for the files that describe the site?
 *
 * A crawler that takes robots.txt and the sitemap and never returns has not read
 * anything you wrote. That distinction is invisible in a hit count and it is the
 * one that decides whether your content can reach a model at all.
 */
function ai() {
  const rows = all(
    `SELECT substr(userAgent, 1, 40) AS declared,
            COUNT(*) AS requests,
            SUM(CASE WHEN path IN ${RULES} THEN 1 ELSE 0 END) AS rules,
            SUM(CASE WHEN path IN ${RULES} THEN 0 ELSE 1 END) AS pages,
            COUNT(DISTINCT CASE WHEN path NOT IN ${RULES} THEN path END) AS distinctPages
     FROM RequestReality WHERE ${aiWhere}
     GROUP BY declared ORDER BY requests DESC`,
    ...aiParams
  );

  if (rows.length === 0) {
    console.log("No request has declared a known AI reader identity.");
    console.log("That is a finding, not an error — it is the answer to the question.");
    return;
  }
  console.table(rows);
  console.log("\nrules  = robots.txt, sitemap.xml, llms.txt, ai.txt");
  console.log("pages  = anything you actually wrote");
}

function paths() {
  console.table(
    all(
      `SELECT path, COUNT(*) AS requests, responseStatus AS status,
              COUNT(DISTINCT cfConnectingIp) AS addresses
       FROM RequestReality GROUP BY path, status
       ORDER BY requests DESC LIMIT 30`
    )
  );
}

function corroboration() {
  console.log(`Requests declaring an AI reader: ${one(`SELECT COUNT(*) FROM RequestReality WHERE ${aiWhere}`, ...aiParams)}`);
  console.log(`From distinct addresses:         ${one(`SELECT COUNT(DISTINCT cfConnectingIp) FROM RequestReality WHERE ${aiWhere}`, ...aiParams)}\n`);
  console.log("None of the above has been checked against anything.");
  console.log();
  console.log("A user agent is a claim. On the observatory's own record, one address");
  console.log("presented thirteen crawler identities from ten companies inside seven");
  console.log("seconds while requesting /.git/config and /.env. Every one of those");
  console.log("declarations would appear in the table above as a visit.");
  console.log();
  console.log("Deciding which are real means resolving each address against the list");
  console.log("its vendor publishes, captured on a fixed date so the answer");
  console.log("reproduces. That is not in this package.");
  console.log();
  console.log("Addresses seen most often, for a manual check:");
  console.table(
    all(
      `SELECT cfConnectingIp AS address, COUNT(*) AS requests,
              COUNT(DISTINCT userAgent) AS identitiesPresented
       FROM RequestReality WHERE ${aiWhere}
       GROUP BY address ORDER BY requests DESC LIMIT 10`,
      ...aiParams
    )
  );
}

const commands = { summary, agents, ai, paths, corroboration };

if (!commands[cmd]) {
  console.log(`usage: record <${Object.keys(commands).join("|")}> [path/to/record.db]`);
  process.exit(1);
}

commands[cmd]();
