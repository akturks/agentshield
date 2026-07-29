import { page, escapeHtml } from "../layout.js";
import { buildDeck } from "../verify/deck.js";
import { declaredIdentities } from "../identities.js";

// The site's own problem, handed to the reader.
//
// Every other page here reports a number and asks to be believed. "60 requests
// declared an AI identity, 7 were corroborated" is true, checkable, and lands on
// most readers as a statistic about somebody else's website. The gap it leaves
// is not credibility — it is that nobody has any feel for why the other 53 are
// hard, and a reader without that feel has no reason to care that the figure
// exists.
//
// So this page stops explaining and deals twelve hands. The reader holds the
// stamp, reads the same published list the classifier reads, and finds out from
// the inside that most of the difficulty is not catching liars. It is the third
// button: the one that says a vendor has published nothing to check against, and
// that pressing it feels like failing even when it is the only true answer.
//
// It is also the only page here anybody would send to a friend, which is worth
// saying plainly rather than pretending the motive is purely pedagogical. An
// observatory with no readers measures the web perfectly and tells nobody.
//
// Three honesty constraints, all visible on the page rather than kept in this
// comment. Addresses are synthetic — no visitor's address is ever printed here.
// Cards drawn from agents this site has actually recorded say so, and built ones
// say that. And the deck is an even three-way mix while the record is nothing
// like even, so the real proportions are shown at the end next to the score.

function badge(text) {
  return `<span class="status">${escapeHtml(text)}</span>`;
}

export function verify(canary, published) {
  const deck = buildDeck({ size: 12 });
  const real = declaredIdentities();

  // Serialised for the client. `<` is escaped so no card value can close the
  // script element early — a user agent string is attacker-supplied text and
  // this page prints them.
  const payload = JSON.stringify(deck).replace(/</g, "\\u003c");

  // Named by list rather than by vendor: Google publishes three of the four, and
  // "Google, Google, Google" reads as a rendering fault rather than as a fact
  // about how many separate crawler lists one company keeps.
  const heldOut = deck.heldOut
    .map((h) => `<code>${escapeHtml(h.id)}</code> (${h.prefixes})`)
    .join(", ");
  const longest = deck.heldOut.reduce((n, h) => Math.max(n, h.prefixes), 0);

  const body = `
<h1>Twelve requests. Who is actually who?</h1>

<p class="lede">A user agent is a claim, not an identity. Some vendors publish the
addresses their crawlers use, so the claim can be checked. Most do not. Here are
twelve arrivals — decide each one.</p>

<p>This is the whole job of the <a href="/lab">verification figures</a> on this
site, done by hand. There are three stamps and one of them is not a failure:</p>

<div class="qa">
<h3>Corroborated</h3>
<p>The address is inside the range this vendor publishes for this crawler. The
claim is supported by a source the client does not control.</p>
<h3>Contradicted</h3>
<p>The vendor publishes a list and this address is not on it. This is the only
stamp that is evidence against a client — and even then it means the declaration
is unsupported, never that somebody intended to deceive.</p>
<h3>Uncheckable</h3>
<p>No published list exists. Nothing can be concluded, however genuine the client
is. Pressing this is not giving up; guessing instead of pressing it is how a
measurement starts publishing opinions.</p>
</div>

<div id="shift">
<noscript>
<p><strong>This page deals its cards with JavaScript, which is not running.</strong>
Everything the game is built from is published without it: the
<a href="/lab#checked">verification split</a>, the
<a href="/lab/methodology">method</a>, and the dated snapshot of every vendor list
the check runs against.</p>
</noscript>
</div>

<h2>What the deck is made of</h2>

<p>Addresses on the cards are <strong>synthetic</strong>. Each one is generated to
sit inside or outside a published range, and the answer is then produced by the
same <code>classify()</code> the site runs on real traffic — so the puzzle is
identical while no observed address is ever printed here. This site records real
clients, and Article VII says the unit of observation is a request and not a
person; putting visitors' addresses on a game screen would break that for
entertainment.</p>

<p>Behaviour on a card — whether that agent has read <a href="/robots.txt">robots.txt</a>,
executed script, or sent a conditional request — is read from the record where
the record has anything to say, and each card tells you which it is. Nothing is
generated to correlate with the answer, because on the real traffic here it does
not: politeness and corroboration are unrelated, and a game that quietly taught
otherwise would be teaching a false rule convincingly.</p>

${
  heldOut
    ? `<p>${deck.heldOut.length} published list${deck.heldOut.length === 1 ? " is" : "s are"}
held out of the deck, with their prefix counts: ${heldOut}. A card shows the
vendor's list in full, and asking whether an address appears among
${longest} prefixes shown ten at a time is not a hard question but an
unanswerable one. Which lists a check can actually be run against is the same
limit this site reports about itself.</p>`
    : ""
}

<p>Every list is read from the committed snapshot captured
<strong>${escapeHtml(deck.snapshot ?? "—")}</strong>, never fetched live. A check
against a list that moves under it reproduces nothing.</p>

<h2>The deck is not the distribution</h2>

<p>Cards are dealt as an even third corroborated, contradicted and uncheckable.
The record is nothing like even. Across every request this site has recorded that
declared one of these identities:</p>

<div class="grid">
<div><div class="stat">${real.requests}</div><div class="stat-label">Declared an AI identity</div></div>
<div><div class="stat">${real.verified}</div><div class="stat-label">Corroborated</div></div>
<div><div class="stat">${real.unlisted}</div><div class="stat-label">Contradicted</div></div>
<div><div class="stat">${real.unverifiable}</div><div class="stat-label">Uncheckable</div></div>
</div>

<p>An even deck is the wrong shape for a figure and the right one for practice.
Dealt in the real proportions, a player would learn to press the same button
every time and would have learned the shape of one small sample rather than the
shape of the problem. <a href="/lab#checked">The real split, per agent</a>.</p>

<script type="application/json" id="deck">${payload}</script>
<script>${GAME}</script>
`;

  return page({
    title: "Verify twelve requests",
    description:
      "A user agent is a claim, not an identity. Twelve arrivals, three stamps, and the same published vendor lists this site checks real traffic against.",
    path: "/verify",
    canary,
    published,
    body
  });
}

// Client-side. Kept in one string rather than a served file because the deck is
// already inline and splitting the two would mean a page that can render a hand
// it has no code to score.
//
// The answer travels with the card. A player who opens the source can read it,
// and that is accepted: this is a teaching surface, not a contest, and the
// alternative — scoring on the server — would mean recording what visitors
// pressed. The record on this site is for observed requests, and turning it into
// a store of people's game answers is a worse trade than a cheatable score.
const GAME = String.raw`
(function () {
  var deck = JSON.parse(document.getElementById("deck").textContent);
  var root = document.getElementById("shift");
  var cards = deck.cards;
  var at = 0;
  var answers = [];

  var STAMPS = [
    ["verified", "Corroborated"],
    ["unlisted", "Contradicted"],
    ["unverifiable", "Uncheckable"]
  ];

  var LABEL = {
    verified: "Corroborated",
    unlisted: "Contradicted",
    unverifiable: "Uncheckable"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function yesNo(v) {
    return v ? "yes" : "no";
  }

  function provenance(c) {
    var b = c.behaviour;
    if (!b.observed) {
      return "Constructed. This site has never recorded a request declaring this agent.";
    }
    // "Requests declaring", not the agent's name, and the difference is the
    // whole page. This line read "Amazonbot has been recorded here 27 times"
    // until 29 July — the counts were right and the sentence was the one that
    // withdrew six findings on 27 July, printed underneath a card whose lesson
    // is that a user agent is a claim rather than an identity.
    //
    // Amazon publishes no address list, so every one of those 27 is
    // unverifiable. The word "Observed" is true of the requests and cannot be
    // true of the company.
    return (
      "Observed. Requests declaring this agent have been recorded here " + b.hits +
      " time" + (b.hits === 1 ? "" : "s") +
      " from " + b.addresses + " address" + (b.addresses === 1 ? "" : "es") +
      ", most recently " + String(b.last).slice(0, 10) + "."
    );
  }

  function listBlock(c) {
    if (!c.hasList) {
      // "No list was found for this agent", not "<Company>: no published list".
      //
      // The second reads as a mark against a company, printed beside behaviour
      // that was invented for the exercise. The first says what was actually
      // done: a search was run on a date and came back empty. Same fact, and
      // only one of them is an observation.
      //
      // The dated reason underneath still names who was searched for, because a
      // reader has to be able to repeat the search. Naming a vendor to describe
      // a check is not the same as making it the subject of conduct.
      return (
        "<p><strong>No published list was found for this agent.</strong></p>" +
        '<p class="lede">' + esc(c.noListReason || "No machine-readable list exists to check against.") + "</p>"
      );
    }
    var items = c.prefixes.map(function (p) {
      return '<code>' + esc(p) + "</code>";
    }).join(" ");
    return (
      "<p><strong>" + esc(c.vendor) + " publishes " + c.prefixes.length +
      " prefix" + (c.prefixes.length === 1 ? "" : "es") + " for " + esc(c.agent) +
      "</strong> <a href=\"" + esc(c.listUrl) + '" rel="nofollow">source</a></p>' +
      '<p style="line-height:2.1">' + items + "</p>"
    );
  }

  function render() {
    if (at >= cards.length) return score();
    var c = cards[at];
    var b = c.behaviour;

    root.innerHTML =
      '<div class="qa">' +
      '<p class="status">Request ' + (at + 1) + " of " + cards.length + "</p>" +
      "<h3>Declares itself as</h3>" +
      "<p><code>" + esc(c.agent) + "</code></p>" +
      "<h3>Arrived from</h3>" +
      "<p><code>" + esc(c.address) + "</code></p>" +
      "<h3>Behaviour</h3>" +
      '<div class="scroll"><table><tbody>' +
      "<tr><td>Requested robots.txt</td><td>" + yesNo(b.readRules) + "</td></tr>" +
      "<tr><td>Executed script</td><td>" + yesNo(b.ranScript) + "</td></tr>" +
      "<tr><td>Sent a conditional request</td><td>" + yesNo(b.conditional) + "</td></tr>" +
      "<tr><td>Most requested path</td><td>" + esc(b.busiestPath || "—") + "</td></tr>" +
      "</tbody></table></div>" +
      "<h3>What the vendor publishes</h3>" +
      listBlock(c) +
      '<p class="status">' + esc(provenance(c)) + "</p>" +
      "</div>" +
      '<p id="stamps">' +
      STAMPS.map(function (s) {
        return '<button data-stamp="' + s[0] + '">' + s[1] + "</button>";
      }).join(" ") +
      "</p>";

    var buttons = root.querySelectorAll("button[data-stamp]");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].addEventListener("click", function () {
        answer(this.getAttribute("data-stamp"));
      });
    }
  }

  function answer(stamp) {
    var c = cards[at];
    var right = stamp === c.answer;
    answers.push({ card: c, stamp: stamp, right: right });

    var why =
      c.answer === "verified"
        ? "The address falls inside one of the prefixes " + c.vendor + " publishes for " + c.agent + "."
        : c.answer === "unlisted"
        ? c.vendor + " publishes a list for " + c.agent + " and this address is on none of it. That makes the declaration uncorroborated — it does not establish intent."
        : c.reason || "No published list exists to check against.";

    root.insertAdjacentHTML(
      "beforeend",
      '<div class="qa">' +
        "<h3>" + (right ? "Correct" : "Not this one") + "</h3>" +
        "<p>You stamped <strong>" + esc(LABEL[stamp]) + "</strong>. The answer is <strong>" +
        esc(LABEL[c.answer]) + "</strong>.</p>" +
        "<p>" + esc(why) + "</p>" +
        '<p><button id="next">' + (at + 1 >= cards.length ? "See the shift" : "Next request") + "</button></p>" +
        "</div>"
    );

    var stamps = document.getElementById("stamps");
    if (stamps) stamps.remove();

    document.getElementById("next").addEventListener("click", function () {
      at += 1;
      render();
      root.scrollIntoView({ block: "start" });
    });
  }

  function score() {
    var right = answers.filter(function (a) { return a.right; }).length;

    // Two ways of being wrong that are worth separating. Guessing on a card that
    // could not be checked is the mistake this whole site exists about; calling a
    // real crawler a fake is the one that costs a site its traffic.
    var guessed = answers.filter(function (a) {
      return a.card.answer === "unverifiable" && a.stamp !== "unverifiable";
    }).length;
    var accused = answers.filter(function (a) {
      return a.card.answer === "verified" && a.stamp === "unlisted";
    }).length;

    var best = 0;
    try {
      best = Math.max(right, parseInt(localStorage.getItem("asd.verify.best") || "0", 10) || 0);
      localStorage.setItem("asd.verify.best", String(best));
    } catch (e) {
      best = right;
    }

    var notes = "";
    if (guessed > 0) {
      notes +=
        "<p>You stamped a verdict on <strong>" + guessed + "</strong> card" +
        (guessed === 1 ? "" : "s") +
        " no list could settle. That is the failure this site is built to avoid: " +
        "a vendor's silence turned into a claim about whoever arrived.</p>";
    }
    if (accused > 0) {
      notes +=
        "<p>You called <strong>" + accused + "</strong> corroborated crawler" +
        (accused === 1 ? "" : "s") +
        " contradicted. On a live site that is the expensive direction — the traffic you block is real.</p>";
    }
    if (!notes) {
      notes = "<p>No guesses on uncheckable cards, and no corroborated crawler called a fake.</p>";
    }

    root.innerHTML =
      '<div class="qa">' +
      "<h3>End of shift</h3>" +
      '<p class="stat">' + right + " / " + cards.length + "</p>" +
      '<p class="stat-label">Correct stamps &middot; best on this device: ' + best + "</p>" +
      notes +
      '<p><button id="again">Deal another shift</button></p>' +
      "</div>" +
      "<p>The figures below are not from the game. They are every request this site " +
      "has actually recorded that declared one of these identities.</p>";

    document.getElementById("again").addEventListener("click", function () {
      location.reload();
    });
  }

  render();
})();
`;
