import db from "../realityDb.js";

// Questions asked of the stored bytes.
//
// Nothing here is written back. Every count below is derived from `body` and
// `headersJson` exactly as they were received, so improving a question means
// re-running this file rather than re-running the survey — and the answer a
// finding published last month can still be recomputed against the same bytes.
//
// The version moves when an answer would change. A percentage published under
// `sa-1` and a percentage published under `sa-2` are not comparable, and the
// only way to keep that legible is to say which one produced a figure.
export const ANALYSIS_VERSION = "sa-1";

// Cloudflare writes its own boundary into the file it modifies. That is unusual
// and it is why this measurement is possible at all: the intervention is
// self-signed, so detecting it needs no heuristic and no guess about what the
// origin "probably" served.
//
// Matched case-insensitively, and not out of caution: the block this site was
// served on 27 July opens with `Managed content` and closes with `Managed
// Content`. An exact match finds the opening, misses the closing, and treats
// everything after it as injected — which, since the block is prepended, leaves
// the owner's own rules invisible and reports every contradiction as zero. The
// figure would have been confident, published, and false.
const MANAGED_BEGIN = /#\s*BEGIN\s+Cloudflare\s+Managed\s+content/i;
const MANAGED_END = /#\s*END\s+Cloudflare\s+Managed\s+content/i;

// The agents this survey asks about. A declared list, like everything else: the
// question "is this site closed to AI crawlers" is only answerable against a
// stated set of them, and picking the set after seeing the files would be
// picking the answer.
export const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai"
];

const lower = (s) => String(s ?? "").toLowerCase();

/**
 * Split a robots.txt into the part a CDN inserted and the part that was already
 * there.
 *
 * Returns `managed: null` when no boundary is present, which is not the same as
 * "no CDN was involved" — it means this particular self-signed intervention was
 * not found. An intervention that does not announce itself is invisible here and
 * the survey must not imply otherwise.
 */
export function splitManaged(body) {
  const text = String(body ?? "");
  const open = MANAGED_BEGIN.exec(text);
  if (!open) return { managed: null, rest: text };

  const begin = open.index;
  const close = MANAGED_END.exec(text.slice(begin));
  const end = close ? begin + close.index + close[0].length : text.length;

  return {
    managed: text.slice(begin, end),
    rest: text.slice(0, begin) + text.slice(end),
    unterminated: !close
  };
}

/**
 * The groups of a robots.txt, in file order.
 *
 * Deliberately lenient. This parses what servers actually send rather than what
 * the specification describes: consecutive `User-agent` lines share one group,
 * unknown directives are kept, and a rule before any agent line is attached to
 * nothing rather than being guessed into a group.
 */
export function parseGroups(text) {
  const groups = [];
  let current = null;
  let expectingAgents = false;

  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") continue;

    const colon = line.indexOf(":");
    if (colon === -1) continue;

    const field = lower(line.slice(0, colon).trim());
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!expectingAgents || current === null) {
        current = { agents: [], rules: [] };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value);
      continue;
    }

    if (current === null) continue;
    expectingAgents = false;
    current.rules.push({ field, value });
  }

  return groups;
}

/**
 * What a file says about one agent: `blocked`, `allowed`, or `unmentioned`.
 *
 * Only the agent's own group is consulted. A `*` group is not treated as an
 * answer about a named crawler, because the question this survey asks is
 * whether somebody decided about that crawler — and a wildcard is precisely the
 * absence of that decision.
 *
 * `blocked` means a bare `Disallow: /`. Narrower disallows are real rules but
 * they are not a closed door, and counting them as one would inflate every
 * figure this produces.
 */
export function verdictFor(text, agent) {
  const target = lower(agent);
  let seen = false;

  for (const group of parseGroups(text)) {
    if (!group.agents.some((a) => lower(a) === target)) continue;
    seen = true;

    for (const rule of group.rules) {
      if (rule.field === "disallow" && rule.value === "/") return "blocked";
    }
  }

  return seen ? "allowed" : "unmentioned";
}

const observations = db.prepare(`
  SELECT domain, rank, httpStatus, contentType, bodyBytes, body, headersJson, errorCode
  FROM RobotsObservation
  WHERE surveyId = ?
  ORDER BY rank
`);

const surveyRow = db.prepare(`SELECT * FROM RobotsSurvey WHERE id = ?`);
const latestSurvey = db.prepare(
  `SELECT id FROM RobotsSurvey ORDER BY declaredAt DESC LIMIT 1`
);

/**
 * A response that actually delivered a robots.txt.
 *
 * A 200 carrying an HTML error page is not a robots.txt, and on a large sample
 * there are many of them. The test is deliberately crude and stated rather than
 * tuned: HTTP 200, and a body that does not open as markup.
 */
function servedRobots(row) {
  if (row.httpStatus !== 200) return false;
  const head = String(row.body ?? "").trimStart().slice(0, 200).toLowerCase();
  return !head.startsWith("<!doctype") && !head.startsWith("<html");
}

/** Whether Cloudflare answered, by its own header. A fact, not an inference. */
function servedByCloudflare(row) {
  try {
    const headers = JSON.parse(row.headersJson ?? "{}");
    return Boolean(headers["cf-ray"]);
  } catch {
    return false;
  }
}

export function analyse(surveyId = latestSurvey.get()?.id) {
  if (!surveyId) return null;

  const survey = surveyRow.get(surveyId);
  if (!survey) return null;

  const rows = observations.all(surveyId);

  const errors = new Map();
  const result = {
    analysisVersion: ANALYSIS_VERSION,
    survey: {
      id: survey.id,
      declaredAt: survey.declaredAt,
      finishedAt: survey.finishedAt,
      populationId: survey.populationId,
      populationUrl: survey.populationUrl,
      sampleRule: survey.sampleRule,
      sampleSize: survey.sampleSize,
      userAgent: survey.userAgent,
      vantagePoint: survey.vantagePoint
    },
    attempted: rows.length,
    answered: 0,
    unreachable: 0,
    servedRobots: 0,
    noRobots: 0,
    behindCloudflare: 0,
    managedBlock: 0,
    managedBlocksAnAiAgent: 0,
    contradicted: 0,
    ownerBlocksAnAiAgent: 0,
    // How many distinct injected blocks there are, byte for byte. One means the
    // same text was served by every site carrying it, which is checkable and
    // says more about where it came from than any argument would.
    managedVariants: 0,
    errorCodes: [],
    // Per agent: how the managed block treats it, and what the rest of the file
    // says about the same name. The second column is the one that matters.
    agents: AI_AGENTS.map((agent) => ({
      agent,
      managedBlocked: 0,
      ownerAllowed: 0,
      ownerUnmentioned: 0,
      ownerBlocked: 0
    }))
  };

  const byAgent = new Map(result.agents.map((a) => [a.agent, a]));
  const managedTexts = new Set();

  for (const row of rows) {
    if (row.errorCode) {
      result.unreachable += 1;
      errors.set(row.errorCode, (errors.get(row.errorCode) ?? 0) + 1);
      continue;
    }

    result.answered += 1;
    if (servedByCloudflare(row)) result.behindCloudflare += 1;

    if (!servedRobots(row)) {
      result.noRobots += 1;
      continue;
    }

    result.servedRobots += 1;

    const { managed, rest } = splitManaged(row.body);

    if (managed === null) {
      // No injected block. The owner's own file is the whole file.
      if (AI_AGENTS.some((agent) => verdictFor(row.body, agent) === "blocked"))
        result.ownerBlocksAnAiAgent += 1;
      continue;
    }

    result.managedBlock += 1;
    managedTexts.add(managed);

    let blocksAny = false;
    let contradictsAny = false;

    for (const agent of AI_AGENTS) {
      if (verdictFor(managed, agent) !== "blocked") continue;

      blocksAny = true;
      const entry = byAgent.get(agent);
      entry.managedBlocked += 1;

      const owner = verdictFor(rest, agent);
      if (owner === "allowed") {
        entry.ownerAllowed += 1;
        contradictsAny = true;
      } else if (owner === "blocked") {
        entry.ownerBlocked += 1;
      } else {
        entry.ownerUnmentioned += 1;
      }
    }

    if (blocksAny) result.managedBlocksAnAiAgent += 1;
    if (contradictsAny) result.contradicted += 1;
    if (AI_AGENTS.some((agent) => verdictFor(rest, agent) === "blocked"))
      result.ownerBlocksAnAiAgent += 1;
  }

  result.managedVariants = managedTexts.size;

  // When every site carrying the block carries the same one, its shape can be
  // described exactly rather than approximately. Computed from the bytes, so a
  // block that gains a tenth crawler tomorrow reports ten without anyone
  // editing a sentence.
  if (managedTexts.size === 1) {
    const [only] = managedTexts;
    result.managedBlockBytes = only.length;
    result.managedBlockGroups = parseGroups(only).length;
    result.managedBlockAiAgents = AI_AGENTS.filter(
      (agent) => verdictFor(only, agent) === "blocked"
    ).length;

    // The block does more than refuse. Its wildcard group carries a
    // `Content-Signal` line, which states a policy about training and reuse
    // rather than allowing or denying a fetch — so it is counted separately
    // from the refusals and never folded into them.
    result.managedBlockContentSignal = /^\s*content-signal\s*:/im.test(only);
  }

  result.errorCodes = [...errors.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  return result;
}
