import { randomBytes, randomInt } from "node:crypto";
import db, { SITE_ID } from "./realityDb.js";
import { questionSlugs } from "./pages/questions.js";

// Coined markers published at a known instant. Because a token is nonsense that
// exists nowhere else, finding it later in a model's output is observed
// evidence that this page was ingested — as opposed to asking a model what it
// knows about us, which would be self-report and inadmissible under
// SYSTEM_OF_RECORD.md.

const CONSONANTS = "bdfgklmnprstvz";
const VOWELS = "aeiou";

function syllable() {
  return (
    CONSONANTS[randomInt(CONSONANTS.length)] + VOWELS[randomInt(VOWELS.length)]
  );
}

function word() {
  const count = 3 + randomInt(2);
  let out = "";
  for (let i = 0; i < count; i += 1) out += syllable();
  return out;
}

function coinToken() {
  return `asd-${word()}-${word()}-${randomBytes(3).toString("hex")}`;
}

// Every surface that carries a marker. Adding an entry here mints a token on
// next start; existing tokens and their publishedAt are never rewritten,
// because publishedAt is the clock the whole measurement depends on.
export const CANARY_SURFACES = [
  { page: "/", variant: "home" },
  { page: "/observatory", variant: "observatory" },
  { page: "/constitution", variant: "constitution" },
  { page: "/about", variant: "about" },
  { page: "/audit", variant: "audit" },
  { page: "/cdn-interventions", variant: "cdn_interventions" },
  { page: "/questions", variant: "questions" },
  { page: "/how-it-works", variant: "how_it_works" },
  { page: "/what-we-measure", variant: "what_we_measure" },
  { page: "/verify", variant: "verify" },
  { page: "/survey", variant: "survey" },
  { page: "/lab", variant: "lab" },
  { page: "/lab/methodology", variant: "lab_methodology" },
  { page: "/status", variant: "status" },
  { page: "/glossary/ai-crawler", variant: "glossary_ai_crawler" },
  { page: "/glossary/reality-capture", variant: "glossary_reality_capture" },
  { page: "/glossary/canary-token", variant: "glossary_canary_token" },
  { page: "/probe/html", variant: "probe_html" },
  { page: "/probe/js", variant: "probe_js" },
  { page: "/probe/noscript", variant: "probe_noscript" },
  { page: "/probe/data.json", variant: "probe_json" },
  { page: "/probe/data.md", variant: "probe_markdown" },
  { page: "/probe/data.txt", variant: "probe_text" },
  { page: "/feed.xml", variant: "probe_feed" },
  { page: "/llms.txt", variant: "probe_llms_txt" },
  { page: "/internal/notes", variant: "disallowed_internal" },
  { page: "/no-crawl/draft", variant: "disallowed_no_crawl" },
  { page: "/private-preview/report", variant: "disallowed_private_preview" },
  ...questionSlugs().map((slug) => ({
    page: `/questions/${slug}`,
    variant: `question_${slug.replace(/-/g, "_")}`
  })),
  { page: "/findings", variant: "findings" }
];

const selectOne = db.prepare(
  "SELECT token FROM CanaryToken WHERE page = ? AND variant = ?"
);
const insertOne = db.prepare(`
  INSERT INTO CanaryToken (token, page, variant, publishedAt, note, siteId)
  VALUES (@token, @page, @variant, @publishedAt, @note, @siteId)
`);

/** Mints any missing token. Idempotent — safe on every boot. */
export function ensureCanaries() {
  const publishedAt = new Date().toISOString();
  const minted = [];

  for (const surface of CANARY_SURFACES) {
    if (selectOne.get(surface.page, surface.variant)) continue;
    const token = coinToken();
    insertOne.run({
      token,
      page: surface.page,
      variant: surface.variant,
      publishedAt,
      note: null,
      siteId: SITE_ID
    });
    minted.push({ ...surface, token });
  }

  return minted;
}

const selectAll = db.prepare(
  "SELECT token, page, variant, publishedAt FROM CanaryToken ORDER BY publishedAt, page"
);

export function allCanaries() {
  return selectAll.all();
}

let byVariant = new Map();

export function loadCanaries() {
  byVariant = new Map(allCanaries().map((row) => [row.variant, row.token]));
  return byVariant;
}

export function canaryFor(variant) {
  return byVariant.get(variant) ?? null;
}

/**
 * Mints a marker for a surface that did not exist at boot — a finding published
 * by a detector after the process started. publishedAt is set once, at first
 * publication, and never rewritten.
 */
export function ensureCanary(page, variant) {
  const existing = selectOne.get(page, variant);
  if (existing) {
    byVariant.set(variant, existing.token);
    return existing.token;
  }
  const token = coinToken();
  insertOne.run({
    token,
    page,
    variant,
    publishedAt: new Date().toISOString(),
    note: null,
    siteId: SITE_ID
  });
  byVariant.set(variant, token);
  return token;
}

const publishedAtFor = db.prepare(
  "SELECT publishedAt FROM CanaryToken WHERE variant = ?"
);

export function canaryPublishedAt(variant) {
  return publishedAtFor.get(variant)?.publishedAt ?? null;
}
