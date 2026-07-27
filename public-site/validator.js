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
export function etagFor(body) {
  return `"${createHash("sha256")
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

  return header
    .split(",")
    .map((t) => t.trim().replace(/^W\//, ""))
    .some((t) => t === etag);
}
