import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { VENDOR_LISTS, NO_PUBLISHED_LIST, listForAgent, siblingLists } from "./sources.js";

const here = dirname(fileURLToPath(import.meta.url));

// A user agent is a claim. Until now this site could only say so; the vendors
// above publish the addresses their crawlers use, which turns the claim into
// something checkable against a source the client does not control.
//
// The check runs against a committed snapshot rather than the live list, so a
// finding published today still reproduces next year. Its date is carried into
// every result and printed in the finding — a verification whose evidence has
// silently moved on is not a verification.

function newestSnapshot() {
  const files = readdirSync(here)
    .filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (files.length === 0) return null;
  const file = files[files.length - 1];
  return { file, ...JSON.parse(readFileSync(join(here, file), "utf8")) };
}

const snapshot = newestSnapshot();

export const SNAPSHOT_DATE = snapshot?.capturedAt?.slice(0, 10) ?? null;
export const VERIFIER_SOURCE = snapshot ? snapshot.file : null;

// ---------------------------------------------------------------------------
// Prefix matching. Both families are compared as integers over the masked bits,
// never as text: a textual prefix match on "74.7.24" would also match 74.7.240
// through 74.7.249, which is the class of error this whole module exists to
// avoid making about someone.

export function ipv4ToInt(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

export function ipv6ToInt(address) {
  if (!address.includes(":")) return null;

  const [head, tail] = address.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === undefined || tail === "" ? [] : tail.split(":");

  if (address.includes("::")) {
    const missing = 8 - headGroups.length - tailGroups.length;
    if (missing < 0) return null;
    var groups = [...headGroups, ...Array(missing).fill("0"), ...tailGroups];
  } else {
    var groups = address.split(":");
  }

  if (groups.length !== 8) return null;

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

/** Is this address inside this CIDR prefix? Unparseable input is never a match. */
export function inPrefix(address, prefix) {
  if (typeof address !== "string" || typeof prefix !== "string") return false;
  const [network, bitsText] = prefix.split("/");
  const bits = Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0) return false;

  const v6 = network.includes(":");
  const width = v6 ? 128 : 32;
  if (bits > width) return false;

  const toInt = v6 ? ipv6ToInt : ipv4ToInt;
  const a = toInt(address);
  const n = toInt(network);
  if (a === null || n === null) return false;

  // A /0 masks everything away; shifting by the full width is the identity in
  // BigInt, so the all-ones mask has to be built from the bit count directly.
  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(width - bits);
  return (a & mask) === (n & mask);
}

function listContains(listId, address) {
  const entry = snapshot?.lists?.[listId];
  if (!entry) return false;
  return entry.prefixes.some((p) => inPrefix(address, p));
}

// ---------------------------------------------------------------------------

/**
 * What the published lists say about one request.
 *
 * Four outcomes, and the distinction between the last two is the point:
 *
 *   verified     the address is in the list this vendor publishes for this agent
 *   vendor_other the vendor publishes it, but under a different one of its crawlers
 *   unlisted     the vendor publishes a list and this address is in none of them
 *   unverifiable no list exists to check against — the vendor's gap, not the client's
 *
 * `unlisted` is the only outcome that is evidence against the client, and even
 * then it is evidence that the declaration is unsupported, not proof of intent.
 */
export function classify(agent, address) {
  const at = SNAPSHOT_DATE;

  if (!snapshot) {
    return { status: "unverifiable", reason: "no snapshot of any published list is available", at };
  }

  if (NO_PUBLISHED_LIST[agent]) {
    return { status: "unverifiable", reason: NO_PUBLISHED_LIST[agent], at };
  }

  const list = listForAgent(agent);
  if (!list) {
    return { status: "unverifiable", reason: "no published list is registered for this agent", at };
  }
  if (!snapshot.lists?.[list.id]) {
    return {
      status: "unverifiable",
      reason: `${list.vendor} publishes a list for this agent but the snapshot does not hold it`,
      at
    };
  }

  if (!address) {
    return { status: "unverifiable", reason: "the request carries no client address", at };
  }

  if (listContains(list.id, address)) {
    return { status: "verified", vendor: list.vendor, list: list.id, url: list.url, at };
  }

  for (const sibling of siblingLists(list.id)) {
    if (listContains(sibling.id, address)) {
      return {
        status: "vendor_other",
        vendor: list.vendor,
        list: sibling.id,
        url: sibling.url,
        at
      };
    }
  }

  return { status: "unlisted", vendor: list.vendor, list: list.id, url: list.url, at };
}

/**
 * The prefixes held in the snapshot for one list, or an empty array.
 *
 * A copy is returned rather than the array itself. Callers outside this module
 * display and sample these; handing out the live array would let a caller sort
 * or splice the list the classifier checks against, which would change what
 * `classify` says without anything in the record changing.
 */
export function prefixesFor(listId) {
  return [...(snapshot?.lists?.[listId]?.prefixes ?? [])];
}

/** Which agents this site can check at all, for stating coverage honestly. */
export function verifiableAgents() {
  return VENDOR_LISTS.filter((l) => snapshot?.lists?.[l.id]).flatMap((l) => l.agents);
}

export function snapshotSummary() {
  if (!snapshot) return null;
  return {
    file: snapshot.file,
    capturedAt: snapshot.capturedAt,
    lists: Object.entries(snapshot.lists).map(([id, e]) => ({
      id,
      url: e.url,
      prefixes: e.prefixes.length,
      creationTime: e.creationTime ?? null
    }))
  };
}
