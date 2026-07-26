import { escapeHtml } from "../layout.js";

// Turns a detector candidate into prose. No language model is involved: every
// sentence is a fixed template and every number comes from the detector, which
// got it from a query the verifier will re-run.
//
// The writing is plainer than a person would produce. That is the trade — a
// generated sentence that cannot invent a figure is worth more here than a
// fluent one that might.
//
// It is also written to survive machine translation, because most readers of a
// site like this one will not read it in English. Three rules, each learned by
// getting it wrong:
//
//   Put the claim in the subject, not in a single verb. "<agent> fetched this
//   site inside a trial we ran" came back from Turkish as "<agent> found this
//   site", handing the claim to the crawler.
//
//   Do not open a sentence with a plural noun that is also a verb. A title
//   beginning "73 requests asked for..." was read as an invitation to make
//   requests of us; the operator asked whether the site needed a contact form.
//
//   Never label a figure with a sentence fragment. Table headings like
//   "Requests on www.example.com", "of those, inside a trial we ran" and
//   "AI-crawler requests on any other hostname" came back as "you may make
//   requests from www.example.com", "some of those..." — replacing an exact
//   count with a vague quantifier — and as a statement that the crawler does
//   this, on a row whose value was zero. A translator handed a fragment will
//   supply the missing verb and quantifier itself. Every counted row therefore
//   asks "How many ...", which cannot be re-parsed as an instruction or a claim.

export const TEMPLATE_VERSION = "tpl-8";

const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

function limits(items) {
  return `<h2>Limits</h2>\n<ul>\n${items.map((l) => `<li>${l}</li>`).join("\n")}\n</ul>`;
}

const UA_CLAIM_LIMIT =
  "The declared user agent is unverified. Any client can send any string, so this describes a claim rather than a confirmed identity.";
const SINGLE_SITE_LIMIT =
  "One domain, observed continuously. Nothing here generalises to how this client behaves elsewhere.";

const TEMPLATES = {
  robots_violation(c) {
    const ua = c.facts.ua ?? "an undeclared client";
    return {
      slug: `robots-violation-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      // The claim is the ordering: rules first, then the paths they forbade.
      // "After reading robots.txt" carries that in a preposition, which is the
      // first thing a translator loosens. Two clauses in sequence survive it.
      title: `This client read our robots.txt first, then took ${c.facts.hits} path${c.facts.hits === 1 ? "" : "s"} it forbids`,
      summary: `A client declaring ${ua} requested /robots.txt and subsequently fetched ${c.facts.hits} path${c.facts.hits === 1 ? "" : "s"} listed under Disallow. The rules were retrieved before the paths were taken.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, a single connecting address requested <code>/robots.txt</code> and afterwards fetched <strong>${c.facts.hits}</strong> path${c.facts.hits === 1 ? "" : "s"} that the same file lists under <code>Disallow</code>.</p>
<p>Declared identity: <code>${escapeHtml(ua)}</code></p>
<p>The disallowed paths on this site serve ordinary content and return <code>200</code>. Nothing is hidden there and nothing is trapped; they exist so that compliance is measurable rather than assumed.</p>
<h2>What it means</h2>
<p>This is the strong form of a compliance failure. The client did not merely take a disallowed path — it retrieved the rules first, so the rules were available to it. robots.txt carries no enforcement, so nothing was broken in a technical sense; what was recorded is that the request was made after the preference had been read.</p>
${limits([
  UA_CLAIM_LIMIT,
  "Ordering is established by timestamp on the same connecting address. A client behind a shared address, or one rotating addresses, may be misattributed.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  ai_agent_arrival(c) {
    const hits = c.facts.hits ?? Number(c.claims[0].expected);
    const prompted = c.facts.prompted ?? 0;
    const allOurs = prompted > 0 && prompted === hits;

    // Findings written before det-7 carry no verification at all. They render as
    // they always did rather than as "0 verified", which would state a result the
    // check never produced.
    const v = c.facts.verification ?? null;
    const checked = v && (v.verified || v.vendorOther || v.unlisted) > 0;
    const fullyVerified = checked && v.verified === hits;

    // The headline is the part that gets indexed, quoted and shared, so the
    // reconciliation with our own trials belongs there and not only in a
    // paragraph further down. "Has been observed" implies nobody asked; when we
    // did ask, the title says so.
    //
    // We are the subject of that sentence on purpose. An earlier version read
    // "<agent> fetched this site inside a trial we ran", which put our own part
    // in a subordinate clause — and machine translation duly dropped it, turning
    // "fetched" into "found" and handing the claim back to the crawler. A claim
    // carried by one verb can be reversed by one mistranslation; a claim carried
    // by the subject cannot.
    //
    // "Has been observed" was the strongest thing this finding could say while
    // the identity was only a claim. When the address checks out against the
    // vendor's own list, the headline can carry that — and it should, because
    // the headline is what gets indexed and quoted, and the difference between
    // a claimed crawler and a corroborated one is the whole subject here.
    const title = allOurs
      ? `We asked ${c.facts.agent} to read this page, and it did`
      : fullyVerified
        ? `${c.facts.agent} fetched this site from an address ${v.vendor} publishes`
        : v && v.unlisted > 0 && v.verified === 0
          ? `Requests claiming to be ${c.facts.agent} came from addresses ${v.vendor ?? "the vendor"} does not publish`
          : `${c.facts.agent} has been observed on this site`;

    const summary = allOurs
      ? `A client declaring ${c.facts.agent} made ${hits} request${hits === 1 ? "" : "s"} across ${c.facts.paths} distinct path${c.facts.paths === 1 ? "" : "s"} on ${day(c.windowStartMs)}. Every one of them arrived inside a window in which we had asked this vendor to read a page here, so this is the result of a trial rather than an unprompted visit.`
      : `A client declaring ${c.facts.agent} made ${hits} request${hits === 1 ? "" : "s"} across ${c.facts.paths} distinct path${c.facts.paths === 1 ? "" : "s"}, first seen ${day(c.windowStartMs)}.${
          fullyVerified
            ? ` Every request came from an address ${v.vendor} publishes for this crawler, checked against their list as it stood on ${v.snapshot}.`
            : v && v.unlisted > 0
              ? ` ${v.unlisted} of those requests came from an address in none of ${v.vendor ?? "the vendor"}'s published ranges.`
              : ""
        }${prompted ? ` ${prompted} of those requests fall inside a trial we ran.` : ""}`;

    return {
      slug: `ai-agent-arrival-${c.facts.agent.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      summary,
      body: `
<h2>What was observed</h2>
<p>First request ${fmt(c.windowStartMs)} UTC, most recent ${fmt(c.windowEndMs)} UTC.</p>
<table>
<tbody>
<tr><th>Declared agent</th><td><code>${escapeHtml(c.facts.agent)}</code></td></tr>
<tr><th>How many fetches it made</th><td>${hits}</td></tr>
<tr><th>How many different paths it took</th><td>${c.facts.paths}</td></tr>
<tr><th>How many different addresses it came from</th><td>${c.facts.ips}</td></tr>
<tr><th>How many of those we caused ourselves, by asking this vendor to read a page</th><td>${prompted} of ${hits}</td></tr>
${
  v
    ? `<tr><th>How many came from an address ${escapeHtml(v.vendor ?? "the vendor")} publishes for this crawler</th><td>${
        checked
          ? `${v.verified} of ${hits}${v.unlisted ? ` &middot; ${v.unlisted} from no published address of theirs` : ""}${v.vendorOther ? ` &middot; ${v.vendorOther} from a range they publish for a different crawler` : ""}`
          : "not checkable — see below"
      }</td></tr>`
    : ""
}
</tbody>
</table>
<h2>What it means</h2>
${
  allOurs
    ? `<p><strong>We caused this.</strong> All ${hits} requests arrived inside a window in which we had asked this vendor to read a page here, so nothing on this page describes a client finding the site on its own. What it does describe is what that vendor's fetcher actually did once asked — which paths it took, whether it read robots.txt first, whether it ran the script — and that is worth recording even though we started it.</p>
<p>Strictly, arriving inside the window is correlation and not proof of cause; an unrelated visit could land in the same ten minutes. Here the correlation is not the reason for the claim — we know we asked, and the trial log says so.</p>`
    : prompted
      ? `<p>Arrival is the entire event. This records that a client presenting this identity reached the site and what it took; it does not establish why it came, whether the content was retained, or whether it will return.</p>
<p><strong>Part of this traffic may be our own doing.</strong> ${prompted} of these ${hits} requests arrived inside a window in which we had asked this vendor to read a page here. That is a correlation over time, not a proven cause, but it is the one explanation the observation record can never contain — so it is stated here rather than left for a reader to wonder about.</p>`
      : `<p>Arrival is the entire event. This records that a client presenting this identity reached the site and what it took; it does not establish why it came, whether the content was retained, or whether it will return.</p>
<p>No registered trial of ours was running when any of this arrived. That is not proof it came unprompted: it means only that if something of ours caused it, the cause was not written down, which is a gap in our record-keeping rather than evidence either way.</p>`
}
${
  !v
    ? ""
    : fullyVerified
      ? `<h2>The declared identity was checked against the vendor's own list</h2>
<p>${escapeHtml(v.vendor)} publishes the addresses this crawler is allowed to use. Every one of these ${hits} request${hits === 1 ? "" : "s"} came from an address inside that list, as it stood on ${escapeHtml(v.snapshot ?? "the captured date")}.</p>
<p>This is the one part of the claim the client does not control. A user agent string can say anything; the address a packet arrives from is chosen by whoever routes it, and matching it against a list the vendor published independently is corroboration from a source with no stake in this record. It is not proof of the software: it establishes the network the request came from, not what program sent it.</p>`
      : v.unlisted > 0
        ? `<h2>Some of these addresses are not in the vendor's published list</h2>
<p>${escapeHtml(v.vendor ?? "The vendor")} publishes the addresses this crawler uses. ${v.unlisted} of these ${hits} request${hits === 1 ? "" : "s"} came from an address in none of their published ranges, checked against the list as it stood on ${escapeHtml(v.snapshot ?? "the captured date")}.</p>
<p><strong>That is a statement about the declaration, not about intent.</strong> It means the claim to be this crawler is unsupported by the only independent source available. It does not establish who sent the request or why, and there are ordinary explanations — a vendor operating from a range it has not published, a proxy, a list we captured before it was updated. What can be said is that the identity in the user agent is not corroborated.</p>`
        : checked
          ? `<h2>The declared identity was checked against the vendor's own list</h2>
<p>Of these ${hits} request${hits === 1 ? "" : "s"}, ${v.verified} came from an address ${escapeHtml(v.vendor ?? "the vendor")} publishes for this crawler and ${v.vendorOther} from a range they publish for a different one of their crawlers, as the lists stood on ${escapeHtml(v.snapshot ?? "the captured date")}. Both are their addresses; the split is recorded rather than smoothed over.</p>`
          : `<h2>This identity cannot be checked against anything</h2>
<p>${escapeHtml(v.reason ?? "No published address list exists for this agent.")}</p>
<p>So the declaration stands unexamined — not contradicted, and not corroborated either. This is a gap in what the vendor publishes rather than anything observed about the client, and it is stated here because the difference between "checked and consistent" and "not checkable" is invisible in a table of counts.</p>`
}
${limits([
  fullyVerified
    ? "An address check confirms the network, not the software. The address is one the vendor publishes for this crawler, which is strong corroboration from an independent source; it still establishes where the request came from rather than what program sent it."
    : UA_CLAIM_LIMIT,
  ...(v && v.snapshot
    ? [
        `Published address lists change. This was checked against the lists as captured on ${v.snapshot}; a vendor that adds a range afterwards makes an older answer stale rather than wrong, which is why the capture date is stated with the result.`
      ]
    : []),
  "Fetching is not ingestion. Whether any of this content persists in a model is measured separately, by the coined markers listed on the lab page.",
  "An arrival cannot be shown to be unprompted. Nothing in a request says why it was made, so “nobody asked for this” rests entirely on our own trial log being complete.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  automated_enumeration(c) {
    return {
      slug: `automated-enumeration-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      title: `One address requested ${c.facts.paths} distinct paths within ${c.facts.seconds} seconds`,
      summary: `A single connecting address took ${c.facts.paths} distinct paths in ${c.facts.seconds} seconds, a rate no interactive session produces.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, one connecting address requested <strong>${c.facts.paths}</strong> distinct paths.</p>
<p>Declared identity: <code>${escapeHtml(c.facts.ua ?? "(none sent)")}</code></p>
<h2>What it means</h2>
<p>The rate distinguishes systematic retrieval from reading. It does not establish intent — a well-behaved archiver and a scanner looking for an unpatched installation produce a similar shape, and separating them requires looking at which paths were chosen rather than how many.</p>
${limits([
  UA_CLAIM_LIMIT,
  "The threshold is a chosen parameter, not a natural boundary. A slower client doing the same thing falls below it.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  distributed_crawl(c) {
    const share = Math.round((c.facts.singles / c.facts.ips) * 100);
    return {
      slug: `distributed-crawl-${day(c.windowStartMs)}-${c.facts.ua.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`,
      title: `One user agent, ${c.facts.ips} addresses, ${c.facts.paths} paths — a retrieval spread thin enough to look like nothing`,
      summary: `A single user agent string arrived from ${c.facts.ips} distinct addresses in ${c.facts.countries} countries over ${c.facts.hours} hours. ${c.facts.singles} of those addresses sent exactly one request. Between them they fetched ${c.facts.paths} distinct paths.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC:</p>
<table>
<tbody>
<tr><th>Declared agent</th><td><code>${escapeHtml(c.facts.ua)}</code></td></tr>
<tr><th>How many different addresses</th><td>${c.facts.ips}</td></tr>
<tr><th>How many of those addresses sent exactly one fetch</th><td>${c.facts.singles} (${share}%)</td></tr>
<tr><th>How many different paths were fetched</th><td>${c.facts.paths}</td></tr>
<tr><th>How many countries those addresses resolved to</th><td>${c.facts.countries}</td></tr>
<tr><th>How many fetches in total</th><td>${c.facts.hits}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
<p>Every request here is unremarkable on its own. One address, one page, an ordinary browser string — nothing that any rate limit or per-address rule would react to. The pattern only exists when the requests are grouped by what they claimed to be rather than where they came from.</p>
<p>This is the blind spot in the other rule on this site. <a href="/findings">Automated enumeration</a> groups by address and asks which client took many paths quickly; a retrieval arranged one request per address is precisely what that question cannot see. The two rules fail in opposite directions, and neither is a substitute for the other.</p>
<p>What the counts establish is coverage without concentration: a large share of this site's pages was fetched, and almost no address fetched more than one of them. What they do not establish is that one party arranged it. That inference is the obvious one, and it is still an inference.</p>
${limits([
  UA_CLAIM_LIMIT,
  "Shared user agent strings are not evidence of a shared operator. A common mobile browser behind carrier NAT can produce many addresses sending one request each, from unrelated people, with no coordination at all.",
  "Country is Cloudflare's geolocation of the connecting address. It describes where the address resolves, not where the client or its operator is.",
  "The thresholds — how many addresses, how few requests each — are chosen parameters. A retrieval spread more thinly still falls below them and is not reported.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  arrival_host(c) {
    const {
      canonical,
      hosts,
      aiOnCanonical,
      promptedOnCanonical,
      unpromptedOnCanonical,
      aiElsewhere,
      otherHostRequests,
      otherHostNotOurs
    } = c.facts;

    const others = hosts.filter((h) => h.host !== canonical).map((h) => h.host);

    // The headline is about the hostname we never published, not about crawlers
    // using the one we did.
    //
    // The first version led on "every declared AI crawler arrived on the name we
    // announced", which is the unremarkable half of this observation: robots.txt,
    // the sitemap, llms.txt and the feed are generated from one origin and mention
    // no other name, so a crawler working from any of them could not have arrived
    // anywhere else. The finding was pointed at its own control group. What needs
    // explaining is the traffic that asked for a name appearing in none of it.
    //
    // The second version led with "73 requests asked for a hostname…", and the
    // operator read it as people making requests of us and asked whether the site
    // needed a contact form. "Request" carries its HTTP sense only to readers who
    // already have it; translated, it becomes a demand someone is making. The
    // lesson from the title rewrites applies to nouns as well as verbs — the
    // subject here is machines, and the verb is fetching.
    return {
      slug: `arrival-host-${day(c.windowEndMs)}`,
      title: `Machines are fetching this site through a second hostname of ours that we never published`,
      summary: `Our server answers to two names. Everything this site publishes — robots.txt, the sitemap, llms.txt, the feed, every canonical tag — uses ${canonical} and never ${others.join(" or ")}. Even so, ${otherHostRequests} fetches arrived asking for ${others.join(", ")}, ${otherHostNotOurs} of them from machines that do not share our own browser language settings. They did not learn that name from us.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC. Both hostnames return <code>200</code> for every path and carry a canonical tag pointing at <code>${escapeHtml(canonical)}</code>; there is no redirect between them.</p>
<table>
<thead><tr><th>Hostname</th><th>How many fetches</th></tr></thead>
<tbody>
${hosts.map((h) => `<tr><td><code>${escapeHtml(h.host)}</code>${h.host === canonical ? " (canonical)" : ""}</td><td>${h.n}</td></tr>`).join("\n")}
</tbody>
</table>
<table>
<tbody>
<tr><th>How many fetches asked for ${escapeHtml(others.join(", "))}</th><td>${otherHostRequests}</td></tr>
<tr><th>How many of those came from a machine that does not share our browser language settings</th><td>${otherHostNotOurs}</td></tr>
<tr><th>How many fetches by a declared AI crawler asked for ${escapeHtml(canonical)}</th><td>${aiOnCanonical}</td></tr>
<tr><th>How many of those we caused ourselves, by asking a vendor to read a page</th><td>${promptedOnCanonical}</td></tr>
<tr><th>How many fetches by a declared AI crawler asked for any other hostname</th><td>${aiElsewhere}</td></tr>
</tbody>
</table>
<h2>What it means</h2>
<p>Every surface this site publishes is generated from a single origin and names <code>${escapeHtml(canonical)}</code> only. A client working from robots.txt, the sitemap, <code>llms.txt</code>, the feed or a canonical tag could not have learned any other name here. So the ${otherHostNotOurs} requests above arrived carrying a name they got from somewhere else: DNS, a certificate transparency log, a scraped list, or a source we cannot see.</p>
<p>That is the part worth recording. The mirror-image figure — declared AI crawlers on the canonical name — is not evidence of anything, because the canonical name is the only one they could have been given. This finding first led on that figure, which was pointing it at its own control group.</p>
${
  promptedOnCanonical
    ? `<p><strong>${promptedOnCanonical} of the ${aiOnCanonical} AI-crawler requests were caused by us</strong>, arriving inside windows in which we had asked a vendor to read a page here. That leaves ${unpromptedOnCanonical} unprompted — too few to describe crawler behaviour, and stated here so the larger number is not read as one.</p>`
    : ""
}
<p>The two hostnames are deliberately still in place. A redirect is the ordinary advice and was the first thing considered; measuring first showed that no figure published here is computed per hostname, so nothing was being corrupted, and that a redirect would have made every future arrival identical and destroyed exactly the signal above. Duplicate content is already handled by canonical tags on both names.</p>
${limits([
  UA_CLAIM_LIMIT,
  `Sample size. ${unpromptedOnCanonical} unprompted AI-crawler request${unpromptedOnCanonical === 1 ? "" : "s"}, and ${otherHostNotOurs} on the unpublished hostname, most of them one distributed retrieval. This describes what arrived here; it is not a result about crawlers in general.`,
  "The language-profile subtraction is a narrowing, not an exclusion: those requests remain in every published total, and are described on the lab page. It is used here only so a claim about clients finding an unadvertised name does not rest on our own phone.",
  "Hostname is the Host header as received. It records the name a client asked for, not how it learned it. Every explanation offered above is an inference; the route is recorded nowhere.",
  "Absence of a redirect is a choice this project made, and it shapes what can be seen here. A site that redirects would produce none of these figures.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  identity_inconsistency(c) {
    return {
      slug: `identity-inconsistency-${day(c.windowStartMs)}-${c.subjectKey.slice(0, 8).replace(/[^a-z0-9]/gi, "")}`,
      title: `One address presented contradictory identities, including a well-known AI crawler`,
      summary: `A single connecting address sent ${c.facts.identities} different user agent strings, among them ${c.facts.claimedAgents.length} matching a known AI crawler and at least one plain command-line client. At most one of these claims can describe the same software.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, one connecting address presented <strong>${c.facts.identities}</strong> distinct user agent strings.</p>
<p>Among them, ${c.facts.claimedAgents.length} matched a known AI crawler:</p>
<ul>
${c.facts.claimedAgents.map((a) => `<li><code>${escapeHtml(a)}</code></li>`).join("\n")}
</ul>
<p>The same address also sent a plain command-line client agent such as <code>curl</code> or <code>Python-urllib</code>.</p>
<h2>What it means</h2>
<p>Major AI crawlers operate from their own infrastructure and do not share an address with an interactive shell. An address making both claims is presenting at least one identity that is not its own.</p>
<p>This does not identify who was responsible or why. It may be testing, a proxy carrying unrelated traffic, or deliberate impersonation. What the record establishes is narrower and firmer: the declared identity on that address cannot be taken at face value, which is the reason this observatory stores user agents as claims and counts them as claims.</p>
${limits([
  "A shared address — a proxy, a VPN exit, a corporate gateway — can carry unrelated clients and produce this pattern without any impersonation.",
  "This rule detects contradiction, not authenticity. It cannot confirm that an agent presenting a single consistent identity is genuine.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  js_execution(c) {
    return {
      slug: `js-execution-${(c.facts.ua ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      title: `A client executed JavaScript on this site`,
      summary: `A client declaring ${c.facts.ua ?? "no user agent"} reached the beacon on the script-rendered probe ${c.facts.beacons} time${c.facts.beacons === 1 ? "" : "s"}, which requires having executed the page's script.`,
      body: `
<h2>What was observed</h2>
<p>Between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC, a client reached the beacon URL <strong>${c.facts.beacons}</strong> time${c.facts.beacons === 1 ? "" : "s"}.</p>
<p>Declared identity: <code>${escapeHtml(c.facts.ua ?? "(none sent)")}</code></p>
<h2>What it means</h2>
<p>The beacon is requested only by the script embedded in the probe page. Reaching it therefore requires having executed that script — this is observed capability rather than capability inferred from a user agent string.</p>
${limits([
  UA_CLAIM_LIMIT,
  "This establishes execution on these visits. It does not establish that the client executes scripts generally, nor that it does so when crawling other sites.",
  SINGLE_SITE_LIMIT
])}`
    };
  },

  format_preference(c) {
    const rows = c.facts.rows;
    return {
      slug: `format-preference-${day(c.windowEndMs)}`,
      title: `Which content formats are actually fetched`,
      summary: `Across ${c.facts.total} fetches of identical content published in several formats, ${rows[0].variant} was requested most often (${rows[0].hits}).`,
      body: `
<h2>What was observed</h2>
<p>The same statement is published as HTML, JSON, Markdown, plain text and RSS, each linked equally and listed in the sitemap. Fetches between ${fmt(c.windowStartMs)} and ${fmt(c.windowEndMs)} UTC:</p>
<table>
<thead><tr><th>Variant</th><th>How many fetches</th></tr></thead>
<tbody>
${rows.map((r) => `<tr><td><code>${escapeHtml(r.variant)}</code></td><td>${r.hits}</td></tr>`).join("\n")}
</tbody>
</table>
<h2>What it means</h2>
<p>Counts of what was requested, nothing more. A fetched format may have been discarded, and a format not fetched may simply never have been discovered despite equal linking.</p>
${limits([
  "Fetch counts are not preference. They record retrieval, not what was used or retained.",
  "Traffic here includes ordinary browsers and scanners as well as AI clients; this figure is not filtered to AI agents alone.",
  SINGLE_SITE_LIMIT
])}`
    };
  }
};

export function render(candidate) {
  const template = TEMPLATES[candidate.detectorId];
  if (!template) return null;
  const out = template(candidate);
  return { ...out, slug: out.slug.replace(/-+/g, "-").replace(/-$/, "") };
}
