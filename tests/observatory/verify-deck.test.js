import test from "node:test";
import assert from "node:assert/strict";

import db from "../../public-site/realityDb.js";
import { buildDeck, HELD_OUT } from "../../public-site/verify/deck.js";
import { classify, inPrefix, prefixesFor } from "../../public-site/vendors/index.js";
import { listForAgent } from "../../public-site/vendors/sources.js";

// A game that marks a right answer wrong teaches the wrong thing, and this one
// is attached to a site whose entire argument is that it does not publish claims
// it cannot support. So the deck is tested for the three ways it could quietly
// lie: an answer the classifier disagrees with, a card that cannot be solved
// from what it shows, and a real client's address printed on a screen.
//
// Decks are random, so each test deals several and checks every card. A property
// that holds on one shuffle and not the next is exactly the defect worth
// catching here.

const DECKS = 8;

function everyCard(fn) {
  for (let i = 0; i < DECKS; i += 1) {
    for (const card of buildDeck({ size: 12 }).cards) fn(card);
  }
}

test("every answer is the one the classifier gives, not one the deck asserted", () => {
  everyCard((card) => {
    const fresh = classify(card.agent, card.address);
    assert.equal(
      card.answer,
      fresh.status,
      `${card.agent} at ${card.address}: card says ${card.answer}, classify says ${fresh.status}`
    );
  });
});

test("a corroborated card shows the prefix that corroborates it", () => {
  // The failure this prevents is the cruellest one available: a card whose
  // answer is right, whose displayed evidence says otherwise, and which
  // therefore punishes a player for reading carefully.
  everyCard((card) => {
    if (card.answer !== "verified") return;
    const covering = card.prefixes.filter((p) => inPrefix(card.address, p));
    assert.ok(
      covering.length > 0,
      `${card.agent} at ${card.address} is corroborated but no shown prefix covers it`
    );
  });
});

test("a contradicted card shows a list the address is genuinely absent from", () => {
  everyCard((card) => {
    if (card.answer !== "unlisted") return;
    assert.ok(card.prefixes.length > 0, "a contradicted card must show the list it contradicts");
    for (const prefix of card.prefixes) {
      assert.ok(
        !inPrefix(card.address, prefix),
        `${card.address} is inside ${prefix}, which the card shows while answering unlisted`
      );
    }
  });
});

test("an uncheckable card shows no list and says why", () => {
  everyCard((card) => {
    if (card.answer !== "unverifiable") return;
    assert.equal(card.prefixes.length, 0, "there is nothing to show when nothing is published");
    assert.equal(card.hasList, false);
    assert.ok(
      typeof card.reason === "string" && card.reason.length > 0,
      `${card.agent} is uncheckable without a recorded reason`
    );
  });
});

test("every card shows its vendor's list in full, so every card is solvable", () => {
  // The deck holds out lists too long to display. Without that rule a card could
  // show ten of Google's 1054 prefixes and ask a question no reader can answer
  // from the evidence in front of them.
  everyCard((card) => {
    const list = listForAgent(card.agent);
    if (!list) return;
    assert.equal(
      card.prefixes.length,
      prefixesFor(list.id).length,
      `${card.agent} shows a partial list`
    );
  });

  assert.ok(HELD_OUT.length > 0, "the held-out set should be reported, not empty by accident");
  for (const held of HELD_OUT) {
    assert.ok(held.prefixes > 40, `${held.id} is held out but is short enough to show`);
  }
});

test("no address on a card is one this site has recorded from a client", () => {
  // Corroborated addresses sit inside ranges the vendor publishes, so they are
  // public by the vendor's own act and may legitimately coincide with observed
  // traffic. Every other address is drawn at random and must not.
  const seen = db.prepare("SELECT 1 AS hit FROM RequestReality WHERE cfConnectingIp = ? LIMIT 1");

  everyCard((card) => {
    if (card.answer === "verified") return;
    assert.equal(
      seen.get(card.address)?.hit,
      undefined,
      `${card.address} appears in the record and is printed on a card`
    );
  });
});

test("dealing a deck writes nothing", () => {
  // The archive's worth is that nobody with a reason to want a particular number
  // has ever written to it. A page anyone on the internet can load must not be
  // able to add a row.
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const before = [count("RequestReality"), count("CanaryToken"), count("Finding")];

  for (let i = 0; i < DECKS; i += 1) buildDeck({ size: 12 });

  assert.deepEqual(
    [count("RequestReality"), count("CanaryToken"), count("Finding")],
    before,
    "building a deck changed the record"
  );
});

test("the deck is evenly split across the three answers", () => {
  // Deliberately not the record's proportions, and tested so the intent survives
  // a later edit: dealt in the real ratio a player would learn to press the same
  // button every time. The page states this next to the real figures.
  for (let i = 0; i < DECKS; i += 1) {
    const tally = { verified: 0, unlisted: 0, unverifiable: 0 };
    const { cards } = buildDeck({ size: 12 });

    assert.equal(cards.length, 12, "a full shift should be dealt");
    for (const card of cards) tally[card.answer] += 1;
    assert.deepEqual(tally, { verified: 4, unlisted: 4, unverifiable: 4 });
  }
});

test("a card says whether its behaviour was observed or built", () => {
  everyCard((card) => {
    assert.equal(typeof card.behaviour.observed, "boolean");
    if (card.behaviour.observed) {
      assert.ok(card.behaviour.hits > 0, `${card.agent} claims observation with no requests`);
    }
  });
});
