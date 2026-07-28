import db from "../realityDb.js";

// The evidence chain for a survey finding.
//
// Every figure the finding states, paired with a query that recomputes it. The
// point is not that the queries are elegant — several are awkward, because the
// question is about the shape of a text file and SQL is not a text parser. The
// point is that a reader does not have to take the number.
//
// A figure that cannot be recomputed this way is not listed here. Padding the
// chain with a claim that restates itself would make the section longer and the
// finding no more checkable.

const BEGIN = "# BEGIN Cloudflare Managed content";

// The eight AI crawlers refused inside the marked block. Written out rather than
// interpolated: the query is published on the page, and a reader checking it
// should see the names it searched for.
const AI_NAMES = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot"
];

// A body that arrived with status 200 and does not open as markup. Repeated in
// several claims because each claim has to stand alone on the page — a reader
// checking one query should not have to assemble it from three others.
const SERVED = `httpStatus = 200
     AND lower(ltrim(body)) NOT LIKE '<!doctype%'
     AND lower(ltrim(body)) NOT LIKE '<html%'`;

const CARRIES = `body LIKE '%BEGIN Cloudflare Managed content%'`;

/** Text of the file with the marked block cut out of it. */
const OUTSIDE = `substr(body, 1, instr(body, '${BEGIN}') - 1)
      || substr(body, instr(body, '${BEGIN}') + 501)`;

export function surveyClaims(surveyId) {
  const where = `FROM RobotsObservation WHERE surveyId = ?`;
  const p = [surveyId];

  return [
    {
      label: "Domains asked for their robots.txt",
      sql: `SELECT COUNT(*) AS n ${where}`,
      params: p
    },
    {
      label: "Domains that answered at all",
      sql: `SELECT COUNT(*) AS n ${where} AND errorCode IS NULL`,
      params: p
    },
    {
      label: "Domains that did not answer",
      sql: `SELECT COUNT(*) AS n ${where} AND errorCode IS NOT NULL`,
      params: p
    },
    {
      label: "Answers that were a robots.txt rather than an error page",
      sql: `SELECT COUNT(*) AS n ${where} AND ${SERVED}`,
      params: p
    },
    {
      label: "Answers delivered through Cloudflare, by its own response header",
      sql: `SELECT COUNT(*) AS n ${where} AND errorCode IS NULL
     AND headersJson LIKE '%"cf-ray"%'`,
      params: p
    },
    {
      label: "Files carrying a block marked as inserted by the CDN",
      sql: `SELECT COUNT(*) AS n ${where} AND ${SERVED} AND ${CARRIES}`,
      params: p
    },
    {
      label: "Distinct marked blocks among those files, compared byte for byte",
      sql: `SELECT COUNT(DISTINCT substr(body, instr(body, '${BEGIN}'), 501)) AS n
   ${where} AND ${CARRIES}`,
      params: p
    },
    {
      label: "Byte at which the marked block begins — identical in every file",
      sql: `SELECT COUNT(DISTINCT instr(body, '${BEGIN}')) AS n
   ${where} AND ${CARRIES}`,
      params: p
    },
    {
      label: "Distinct texts preceding the marked block, compared byte for byte",
      sql: `SELECT COUNT(DISTINCT substr(body, 1, instr(body, '${BEGIN}') - 1)) AS n
   ${where} AND ${CARRIES}`,
      params: p
    },
    {
      label: "Length of that preceding text, in bytes",
      sql: `SELECT MAX(instr(body, '${BEGIN}') - 1) AS n ${where} AND ${CARRIES}`,
      params: p
    },
    {
      // The claim the finding rests on, and the one worth checking hardest: it
      // is what makes the contradiction count zero. Deliberately stricter than
      // the finding needs — it looks for the name anywhere outside the block,
      // not only in a `User-agent` line, so anything short of complete silence
      // would show up here.
      label:
        "Files where any of the eight refused crawlers is named anywhere outside the marked block",
      sql: `SELECT COUNT(*) AS n ${where} AND ${CARRIES} AND (
${AI_NAMES.map((name) => `        ${OUTSIDE} LIKE '%${name}%'`).join("\n     OR ")}
   )`,
      params: p
    }
  ];
}

/** Run the claims and return what each query answers right now. */
export function observe(surveyId) {
  return surveyClaims(surveyId).map((claim) => {
    const row = db.prepare(claim.sql).get(...claim.params);
    return { ...claim, observed: String(Object.values(row)[0]) };
  });
}
