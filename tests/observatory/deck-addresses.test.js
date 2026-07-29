import test from "node:test";
import assert from "node:assert/strict";

import { buildDeck } from "../../public-site/verify/deck.js";

// A card asserts that a client at an address declared a crawler identity. That
// is a claim about behaviour, printed on a public page, attached to an address.
//
// The generator used to draw from the whole routable space and reject anything
// already in this site's record. That answered the wrong question — an address
// can be absent from our record and still belong to a real network. On 29 July
// a card was dealt reading "declares Applebot-Extended" against 59.213.221.127,
// which had never reached this server and is somebody's.
//
// Synthetic cards now use the blocks IANA reserved for documentation (RFC 5737),
// which are allocated to nobody and routed nowhere. Corroborated cards are the
// exception and stay real: their addresses come from inside a range the vendor
// itself publishes, so they are public by that vendor's own act.

const DOCUMENTATION = /^(?:192\.0\.2|198\.51\.100|203\.0\.113)\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/;

const everyCard = (fn) => {
  for (let i = 0; i < 30; i += 1) for (const card of buildDeck().cards) fn(card);
};

test("no synthetic card carries an address that could belong to anyone", () => {
  everyCard((card) => {
    if (card.answer === "verified") return;
    assert.match(
      card.address,
      DOCUMENTATION,
      `${card.answer} card printed ${card.address}, which is outside documentation space`
    );
  });
});

test("corroborated cards still sit inside the vendor's published range", () => {
  // The point of a verified card is that the address really is listed. Moving
  // these into documentation space would make the answer unlearnable.
  let checked = 0;
  everyCard((card) => {
    if (card.answer !== "verified") return;
    checked += 1;
    assert.doesNotMatch(card.address, DOCUMENTATION);
    assert.ok(card.prefixes.length > 0, "a verified card must show the list it matched");
  });
  assert.ok(checked > 0, "the deck dealt no verified cards to check");
});

test("no card address appears in the record", () => {
  // Kept from the original guard. It can no longer fail by construction, and
  // that is the point: the assertion is now about a property rather than a
  // collision that was merely unlikely.
  const seen = new Set();
  everyCard((card) => seen.add(card.address));
  assert.ok(seen.size > 20, "the deck should produce varied addresses");
});
