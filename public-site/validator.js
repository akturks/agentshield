import { createHash } from "node:crypto";

// One definition of "has this changed", so the tag a client is given and the tag
// a later request is compared against cannot drift apart.
//
// Derived from the bytes being sent and nothing else. That means no page has to
// be declared static or dynamic: a page whose content is stable produces a stable
// tag on its own, and /lab — which recomputes its counters on every request —
// produces a new one every time, correctly, which simply means nothing about
// conditional-request behaviour can be concluded from that page.
//
// Truncated to 27 base64url characters, 162 bits of a SHA-256. Long enough that a
// collision between two versions of one page is not a thing that happens; short
// enough to read in a log.
// Weak, and correct rather than a workaround.
//
// A strong tag asserts byte-identity. These pages do not need that claim: what a
// conditional request is asking is whether the page has meaningfully changed, and
// weak comparison is the mechanism HTTP defines for exactly that question.
//
// It is also what survives the CDN. Cloudflare strips a strong ETag from an
// uncached HTML response on this zone — measured 2026-07-27, on both a
// Brotli-compressed and an uncompressed response, so compression is not the
// cause. Preserving strong tags is a Cache Rules setting. Weak tags are passed
// through, so the validator reaches clients without a dashboard rule.
//
// If this too is stripped, the mechanism is intact and unreachable, and the only
// remaining fix is "Respect Strong ETags" in Cache Rules. That would be worth
// recording as a finding in its own right: an intermediary deciding what
// politeness a client is allowed to practise.
export function etagFor(body) {
  return `W/"${createHash("sha256")
    .update(typeof body === "string" ? body : String(body))
    .digest("base64url")
    .slice(0, 27)}"`;
}

/**
 * Does the client already hold this exact version?
 *
 * Handles the list form (`If-None-Match: "a", "b"`) because the header is defined
 * as a list, and the weak prefix `W/` because a client that received a strong tag
 * may still offer it weakly. Anything unparseable is treated as no match, which
 * costs a re-send and never serves a stale body.
 */
export function clientHolds(header, etag) {
  if (!header) return false;
  if (header.trim() === "*") return true;

  // Both sides are normalised. Stripping the prefix from only the offered tag
  // was a real bug for the length of one commit: once our own tags became weak,
  // `W/"x"` was compared against `"x"` and no conditional request could ever
  // match, so the 304 path was unreachable while looking correct.
  const bare = (t) => t.trim().replace(/^W\//, "");

  return header.split(",").map(bare).some((t) => t === bare(etag));
}
