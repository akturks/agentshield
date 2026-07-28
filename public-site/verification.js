import db from "./realityDb.js";

// Ownership tokens for the search consoles, kept in the action layer.
//
// `Config` is where the schema already puts them, beside the IndexNow key, and
// the reason is worth restating: a verification token is something this site
// declares to a third party. It is not an observation, nothing may be concluded
// from it, and the integrity check fails if a published figure ever queries this
// table.
//
// They exist because of a measurement rather than a habit. On 2026-07-28 a
// search for the exact hostname returned nothing, while the record showed 29
// Googlebot and 46 GoogleOther visits — the site was being crawled and was in no
// index. The two links pointing at it, both on GitHub, were measured and both
// carry `rel="nofollow"`, so neither could pass a signal. Registering ownership
// is the remaining mechanism that is not simply waiting.
//
// Whether it changes anything is itself measurable, and the experiment engine is
// where that will be recorded rather than assumed.

const KEYS = {
  "google-site-verification": "verification_google",
  msvalidate: "verification_bing",
  "yandex-verification": "verification_yandex"
};

const read = db.prepare("SELECT value FROM Config WHERE key = ?");
const write = db.prepare(
  `INSERT INTO Config (key, value, updatedAt) VALUES (@key, @value, @updatedAt)
   ON CONFLICT(key) DO UPDATE SET value = @value, updatedAt = @updatedAt`
);

/** Set one console's token. Returns the config key it was stored under. */
export function setVerification(name, value) {
  const key = KEYS[name];
  if (!key) throw new Error(`verification: unknown console "${name}" (${Object.keys(KEYS).join(", ")})`);

  const token = String(value ?? "").trim();
  // A token with markup in it is a pasted whole meta tag. Storing that would
  // emit a tag inside a tag and fail verification in a way that looks like the
  // console's fault.
  if (!token || /[<>"]/.test(token))
    throw new Error("verification: paste the content value only, not the whole meta tag");

  write.run({ key, value: token, updatedAt: new Date().toISOString() });
  return key;
}

/**
 * The meta tags to place in every page's head.
 *
 * Rendered on every page rather than only the home page: the consoles accept
 * either, and a tag that exists on one page is a tag somebody has to remember
 * not to break.
 */
export function verificationTags(escape) {
  return Object.entries(KEYS)
    .map(([name, key]) => [name, read.get(key)?.value])
    .filter(([, value]) => Boolean(value))
    .map(([name, value]) => `<meta name="${name}" content="${escape(value)}">`)
    .join("\n");
}

/** Which consoles have a token, for the status page. */
export function verificationState() {
  return Object.entries(KEYS).map(([name, key]) => ({
    console: name,
    configured: Boolean(read.get(key)?.value)
  }));
}
