import db from "../realityDb.js";
import { EXTERNAL, notOperator } from "../stats.js";
import {
  classify,
  prefixesFor,
  ipv4ToInt,
  ipv6ToInt,
  SNAPSHOT_DATE
} from "../vendors/index.js";
import { VENDOR_LISTS, NO_PUBLISHED_LIST, listForAgent } from "../vendors/sources.js";

// The deck behind /verify: the site's own verification problem, dealt out as
// hands a visitor can play.
//
// Every figure on this site is a number somebody has to be persuaded to care
// about. This is the same question with the reader holding the stamp instead of
// reading the total, and it exists because "60 declared, 7 corroborated" tells
// nobody why the other 53 are hard. Being made to answer twelve of them does.
//
// Three rules govern this file, and the first two are not negotiable.
//
// It never writes. Nothing here inserts, updates or deletes; a game that could
// touch the record would put every published figure in reach of a player, and
// the archive's whole value is that nothing in it was ever written by somebody
// with a reason to want a particular number.
//
// It never publishes an observed address. Addresses on the cards are synthesised
// to sit inside or outside a published range, so the puzzle is identical and no
// visitor's address leaves the machine. Article VII already says the unit of
// observation is a request and not a person; printing real client addresses on a
// game screen would break that for entertainment.
//
// And it never dresses construction as observation. Twelve cards is more variety
// than 816 requests from a handful of agents can supply, so some hands are
// built rather than drawn. Each card carries which it is, in the interface, in
// the words the reader sees.

// A card shows the vendor's list in full, so the deck only draws on vendors
// whose list can be shown in full.
//
// This costs the deck its most-observed agent and is still right. Google
// publishes 1054 prefixes for its user-triggered fetchers; a card showing ten of
// them and asking "is this address listed?" is not a hard question, it is an
// unanswerable one, and a player who guesses correctly has learned nothing
// except that guessing sometimes works. The excluded vendors are named on the
// page rather than quietly dropped — which list a check can actually be run
// against is the same limit the site reports about itself.
const MAX_SHOWABLE_PREFIXES = 40;

// ---------------------------------------------------------------------------
// Addresses
//
// Parsing is imported rather than rewritten. A second implementation of prefix
// matching would be a second opinion about who is inside a vendor's range, and
// the first thing this site learned about restating a rule by hand is that the
// two copies disagree and both get published.

function intToIpv4(value) {
  return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join(".");
}

function intToIpv6(value) {
  const groups = [];
  for (let i = 7; i >= 0; i -= 1) {
    groups.push(Number((value >> BigInt(i * 16)) & 0xffffn).toString(16));
  }
  return groups.join(":");
}

/** A random address inside a CIDR prefix, or null if the prefix will not parse. */
function addressInside(prefix) {
  const [network, bitsText] = String(prefix).split("/");
  const bits = Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0) return null;

  const v6 = network.includes(":");
  const width = v6 ? 128 : 32;
  if (bits > width) return null;

  const base = (v6 ? ipv6ToInt : ipv4ToInt)(network);
  if (base === null) return null;

  let host = 0n;
  for (let i = 0; i < width - bits; i += 1) {
    if (Math.random() < 0.5) host |= 1n << BigInt(i);
  }

  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(width - bits);
  const value = (base & mask) | host;
  return v6 ? intToIpv6(value) : intToIpv4(value);
}

// The three blocks IANA reserved for documentation and examples (RFC 5737).
// They are allocated to nobody and routed nowhere, which is the property this
// page needs.
const DOCUMENTATION_BLOCKS = ["192.0.2", "198.51.100", "203.0.113"];

/**
 * An address for a card that is not, and cannot become, anybody's.
 *
 * This used to draw from the whole routable space, excluding private ranges and
 * anything already in our record. That check answered the wrong question. It
 * asked "has this address ever visited us", when what a card asserts is that a
 * client at that address declared a crawler identity — a claim about behaviour,
 * attached to an address, printed on a public page.
 *
 * An address can be absent from our record and still belong to a real network.
 * 59.213.221.127 was dealt on a card reading "declares Applebot-Extended"; it
 * had never reached this server, and it is somebody's. Fabricating conduct is
 * fine when the deck says the cards are synthetic. Fabricating it against a real
 * address is not, and no amount of improbability fixes that — the fix is to use
 * addresses that cannot be anyone's.
 *
 * A reader who recognises 203.0.113.x as documentation space loses a little
 * realism and learns something true instead. `EXTERNAL` in stats.js already
 * excludes these three blocks, so the rest of the codebase agrees they are not
 * observations.
 *
 * Corroborated cards do not come through here. Their addresses are generated
 * inside a range the vendor itself publishes, so they are public by the vendor's
 * own act — a /32 in Perplexity's list is a documented crawler address, not an
 * observation of anybody.
 */
function documentationIpv4() {
  const block = DOCUMENTATION_BLOCKS[Math.floor(Math.random() * DOCUMENTATION_BLOCKS.length)];
  return `${block}.${1 + Math.floor(Math.random() * 254)}`;
}

// ---------------------------------------------------------------------------
// What the record knows about an agent
//
// Behaviour on a card is drawn from the record where the record has something to
// say. This is the part that cannot be invented convincingly: the reason a card
// showing a polite crawler that turns out to be uncorroborated lands at all is
// that politeness and corroboration really are unrelated here, and the numbers
// underneath say so.

const agentSeen = db.prepare(`
  SELECT COUNT(*) AS hits,
         COUNT(DISTINCT cfConnectingIp) AS addresses,
         MIN(observedAt) AS first,
         MAX(observedAt) AS last
  FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent LIKE ?
`);

const agentReadRules = db.prepare(`
  SELECT COUNT(*) AS hits FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent LIKE ? AND path = '/robots.txt'
`);

const agentRanScript = db.prepare(`
  SELECT COUNT(*) AS hits
  FROM JsExecution j JOIN RequestReality r ON r.id = j.requestId
  WHERE r.cfRay IS NOT NULL AND ${notOperator("r")} AND r.userAgent LIKE ?
`);

const agentConditional = db.prepare(`
  SELECT COUNT(*) AS hits FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent LIKE ?
    AND (headersJson LIKE '%if-none-match%' OR headersJson LIKE '%if-modified-since%')
`);

const agentFormat = db.prepare(`
  SELECT path, COUNT(*) AS hits FROM RequestReality
  WHERE ${EXTERNAL} AND userAgent LIKE ?
  GROUP BY path ORDER BY hits DESC LIMIT 1
`);

function observedBehaviour(agent) {
  const like = `%${agent}%`;
  const seen = agentSeen.get(like);
  if (!seen || seen.hits === 0) return null;

  return {
    observed: true,
    hits: seen.hits,
    addresses: seen.addresses,
    first: seen.first,
    last: seen.last,
    readRules: agentReadRules.get(like).hits > 0,
    ranScript: agentRanScript.get(like).hits > 0,
    conditional: agentConditional.get(like).hits > 0,
    busiestPath: agentFormat.get(like)?.path ?? null
  };
}

// Built behaviour for an agent this site has never been visited by.
//
// Deliberately drawn without reference to the answer. A generator that made
// corroborated crawlers politer than uncorroborated ones would teach the reader
// a rule that is false here — and worse, would teach it convincingly, because
// the game would keep rewarding it.
function constructedBehaviour() {
  return {
    observed: false,
    readRules: Math.random() < 0.5,
    ranScript: Math.random() < 0.15,
    conditional: Math.random() < 0.25,
    busiestPath: ["/", "/lab", "/questions", "/findings", "/probe/data.md"][
      Math.floor(Math.random() * 5)
    ]
  };
}

// ---------------------------------------------------------------------------
// Cards

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * One hand.
 *
 * The answer is not asserted here. An address is synthesised, `classify` is
 * asked about it exactly as it would be asked about a real request, and the card
 * carries whatever came back. If the address generator is ever wrong the card
 * disagrees with its intent and is discarded by the caller rather than dealt —
 * so a defect in this file costs a card, never a wrong answer marked right.
 */
function card(agent, address) {
  const list = listForAgent(agent);
  const result = classify(agent, address);
  const all = list ? prefixesFor(list.id) : [];

  return {
    agent,
    vendor: list?.vendor ?? null,
    address,
    listId: list?.id ?? null,
    listUrl: list?.url ?? null,
    hasList: Boolean(list) && !NO_PUBLISHED_LIST[agent],
    noListReason: NO_PUBLISHED_LIST[agent] ?? null,
    prefixes: all,
    answer: result.status,
    reason: result.reason ?? null
  };
}

const PLAYABLE_LISTS = VENDOR_LISTS.filter((l) => {
  const n = prefixesFor(l.id).length;
  return n > 0 && n <= MAX_SHOWABLE_PREFIXES;
});

/** Vendors held out of the deck because their list is too long to show. */
export const HELD_OUT = VENDOR_LISTS.filter(
  (l) => prefixesFor(l.id).length > MAX_SHOWABLE_PREFIXES
).map((l) => ({ vendor: l.vendor, id: l.id, prefixes: prefixesFor(l.id).length }));

const AGENTS_WITH_LISTS = PLAYABLE_LISTS.flatMap((l) => l.agents);
const AGENTS_WITHOUT_LISTS = Object.keys(NO_PUBLISHED_LIST);

/**
 * Picks an agent, preferring one this shift has not dealt yet.
 *
 * Only four vendors publish a list short enough to show, so twelve cards cannot
 * avoid repeating an agent. Repeating one twice running is worth avoiding
 * anyway: the second card is answered from memory of the first rather than from
 * the list, and a hand nobody reads teaches nothing.
 */
function pick(pool, used) {
  const fresh = pool.filter((a) => !used.has(a));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** A card the vendor's own list corroborates. */
function corroboratedCard(used) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const agent = pick(AGENTS_WITH_LISTS, used);
    const prefixes = prefixesFor(listForAgent(agent).id);
    if (prefixes.length === 0) continue;

    const address = addressInside(prefixes[Math.floor(Math.random() * prefixes.length)]);
    if (!address) continue;

    const built = card(agent, address);
    if (built.answer === "verified") return built;
  }
  return null;
}

/** A card claiming an identity the vendor's list contradicts. */
function contradictedCard(used) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const built = card(pick(AGENTS_WITH_LISTS, used), documentationIpv4());
    if (built.answer === "unlisted") return built;
  }
  return null;
}

/** A card no list can settle, because the vendor publishes none. */
function uncheckableCard(used) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const built = card(pick(AGENTS_WITHOUT_LISTS, used), documentationIpv4());
    if (built.answer === "unverifiable") return built;
  }
  return null;
}

/**
 * A shift.
 *
 * The mix is even across the three answers rather than proportional to the
 * record. Proportional would be the more faithful choice for a figure and the
 * wrong one for a hand: on this site's traffic it would deal almost nothing but
 * uncheckable, and a reader who learns "press the third button" has learned the
 * shape of one small sample instead of the shape of the problem.
 *
 * That asymmetry is stated on the page, next to the real proportions, so nobody
 * leaves believing the deck is the distribution.
 */
export function buildDeck({ size = 12 } = {}) {
  const wanted = [];
  for (let i = 0; i < size; i += 1) {
    wanted.push([corroboratedCard, contradictedCard, uncheckableCard][i % 3]);
  }

  const cards = [];
  const used = new Set();

  for (const make of shuffle(wanted)) {
    const built = make(used);
    if (!built) continue;

    used.add(built.agent);
    const behaviour = observedBehaviour(built.agent) ?? constructedBehaviour();
    cards.push({ ...built, behaviour, n: cards.length + 1 });
  }

  return { cards, snapshot: SNAPSHOT_DATE, heldOut: HELD_OUT };
}
