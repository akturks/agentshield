// The three findings written by hand on 25 July 2026, from the record produced
// during the site's first hours. Kept as source because they are prose a person
// reasoned out; findings/seed.js loads them into the store, and everything
// afterwards renders from there.

import { SITE_ORIGIN } from "../layout.js";

export const FINDINGS = [
  {
    id: "F-001",
    slug: "first-contact-under-two-minutes",
    date: "2026-07-25",
    title:
      "A new domain with no inbound links received its first automated probe in under two minutes",
    summary:
      "agentshieldaidefense.com began serving at approximately 10:43 UTC on 25 July 2026 with no inbound links, no search index presence and no sitemap submitted anywhere. The first unsolicited request arrived at 10:44:54 UTC — roughly two minutes later — probing for a WordPress installation path. Four further independent sources followed within the hour.",
    body: `
<h2>What was observed</h2>

<p>The domain was registered on 31 May 2026 but resolved to nothing until 25 July. DNS began answering at approximately 10:43 UTC. At that moment the site had no inbound links from anywhere, no presence in any search index, and no sitemap had been submitted to any service.</p>

<p>The first unsolicited request arrived at <strong>10:44:54 UTC</strong>, from Germany, requesting <code>/wp-admin/install.php</code> — the setup path of an unconfigured WordPress installation.</p>

<table>
<thead><tr><th>Time (UTC)</th><th>Origin</th><th>Requested</th></tr></thead>
<tbody>
<tr><td>10:44:54</td><td>DE</td><td><code>/wp-admin/install.php</code></td></tr>
<tr><td>10:56:40</td><td>RU</td><td><code>/</code>, <code>/wp-json/</code>, <code>/readme.html</code> (5 requests)</td></tr>
<tr><td>11:22:49</td><td>CN</td><td><code>/</code></td></tr>
<tr><td>11:28:33</td><td>US</td><td><code>/glossary/canary-token</code></td></tr>
<tr><td>11:31:53</td><td>CH</td><td><code>/questions</code></td></tr>
</tbody>
</table>

<p>Five independent sources across five countries within forty-nine minutes of first resolution.</p>

<h2>What it means</h2>

<p>Discovery of a new domain does not require anyone to link to it. Certificate transparency logs, passive DNS, and newly-registered-domain feeds all publish new hostnames continuously, and automated infrastructure consumes those feeds constantly. Being unknown to search engines and being unknown to the internet are different conditions.</p>

<p>The early arrivals were not reading the site. They were testing whether it was a WordPress installation worth attacking — <code>/wp-admin/install.php</code> on an unconfigured site allows an attacker to complete the setup themselves. This is the ambient background of the web, and it reached a two-minute-old domain before any human knew it existed.</p>

<h2>Limits</h2>

<ul>
<li>One domain, one launch, on one day. Time-to-first-contact will vary with registrar, TLD, nameserver and hosting provider, none of which this measures.</li>
<li>The site is served through a CDN, so it appeared in that provider's infrastructure the moment DNS resolved. A directly hosted origin might be discovered on a different curve.</li>
<li>Country codes are geolocations of the connecting address, not attributions. They say where a packet came from, not who sent it.</li>
<li>Declared user agents in these requests are unverified and, for scanners, routinely falsified.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>The interval between a domain becoming reachable and the internet noticing is rarely published, because measuring it requires having instrumented the site before it went live. That ordering is easy to get wrong once and impossible to repeat afterwards.</p>
`
  },
  {
    id: "F-002",
    slug: "assistant-substituted-search-for-fetch",
    date: "2026-07-25",
    title:
      "An assistant given a direct URL substituted a search, and reported a competitor instead",
    summary:
      "Asked to open a specific URL on this site, a commercial AI assistant did not request the page. No corresponding request reached the server. It performed a search instead, found an unrelated company with a similar name, and reported that the requested page was unreachable or unindexed. A second attempt, explicitly instructing it not to search, produced a real fetch.",
    body: `
<h2>What was observed</h2>

<p>A user asked a commercial AI assistant to open <code>${SITE_ORIGIN}/questions</code> and report a specific string printed at the foot of that page.</p>

<p>No request for that URL reached this server. The server record for the relevant window contains no request from the assistant's infrastructure at all — not a blocked one, not a failed one, none.</p>

<p>The assistant reported that it could not reach the page, offered two explanations — that the page might not be indexed by a search engine, or that it might not be published — and cited an unrelated company with a similar name that it had found instead.</p>

<p>A second attempt, with the instruction <em>"Do not search. Use your browsing tool to open this exact URL directly"</em>, produced a genuine fetch at 11:31:53 UTC and a correct answer. See <a href="/findings/anatomy-of-a-user-triggered-fetch">F-003</a>.</p>

<h2>What it means</h2>

<p>Handing an assistant a URL does not reliably cause the URL to be retrieved. The assistant may treat the request as a research task and reach for search, and a search for a new domain returns whatever else occupies that name.</p>

<p>The failure is also instructive in its shape. The assistant's own account of what happened — not indexed, possibly not published — was wrong on both counts. The site was published and reachable; a request from any client, including one declaring the assistant's own user agent, returned <code>200</code> throughout the period. What actually happened was that no request was made.</p>

<p>Only the server record could establish that. The assistant's explanation was a plausible reconstruction of a failure it had not diagnosed, which is exactly the failure mode that makes model self-report inadmissible as evidence here. See <a href="/questions/why-not-just-ask-the-model">why not just ask the model</a>.</p>

<h2>Limits</h2>

<ul>
<li>A single trial, one assistant, one prompt, one session. Tool selection in these systems is not deterministic and the same prompt may fetch on another attempt.</li>
<li>The prompt asked the assistant to "open" the URL, which may read as a research instruction rather than a retrieval one. The wording is part of what was tested.</li>
<li>This site is new and shares a name with an established company, which makes a search substitution unusually visible. On a well-known domain the substitution might have produced a correct answer and gone unnoticed.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>Advice about publishing for AI systems assumes that content handed to an assistant gets read. Whether that assumption holds is measurable from the server side, and here it did not hold until the instruction was made explicit.</p>
`
  },
  {
    id: "F-003",
    slug: "anatomy-of-a-user-triggered-fetch",
    date: "2026-07-25",
    title:
      "Anatomy of a user-triggered fetch: one page, no robots.txt, no JavaScript",
    summary:
      "The first verified AI agent visit to this site fetched exactly one page, did not request robots.txt beforehand, executed no JavaScript, and did not follow a single link. It declared ChatGPT-User in its user agent and connected from cloud infrastructure in Switzerland. Ingestion was confirmed independently by a coined string the client could not have guessed.",
    body: `
<h2>What was observed</h2>

<p>At <strong>11:31:53.064 UTC</strong> on 25 July 2026, a single <code>GET /questions</code> returned <code>200</code> and 14,290 bytes.</p>

<table>
<thead><tr><th>Property</th><th>Observed</th></tr></thead>
<tbody>
<tr><td>Declared identity</td><td><code>Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot</code></td></tr>
<tr><td>Connecting address</td><td>Microsoft cloud infrastructure, Switzerland</td></tr>
<tr><td>Pages fetched</td><td>1</td></tr>
<tr><td>robots.txt requested</td><td>No</td></tr>
<tr><td>Links followed</td><td>0</td></tr>
<tr><td>JavaScript executed</td><td>No</td></tr>
<tr><td>Accept-Encoding</td><td><code>gzip, br</code></td></tr>
</tbody>
</table>

<p>The request carried <code>x-request-id</code> and <code>x-envoy-expected-rq-timeout-ms: 15000</code> headers, indicating a service mesh with a fifteen-second retrieval budget rather than an interactive browser.</p>

<h2>Independent confirmation</h2>

<p>The page carries a coined marker — nonsense syllables plus random hex, minted at 11:15:37 UTC and existing nowhere else. The assistant reported that marker back correctly.</p>

<p>This matters because the two pieces of evidence are independent. The server record shows a fetch occurred; the marker shows the fetched content was actually read and returned to the user. Neither alone would establish both.</p>

<h2>What it means</h2>

<p>This is the user-triggered fetcher profile in its clearest form: arrive, take exactly the requested resource, leave. No crawl, no discovery, no script execution, no interest in the site's rules — because from this client's perspective a person has already granted permission by asking.</p>

<p>The absence of a robots.txt request is worth stating precisely. <strong>No rule was violated.</strong> The client did not read the rules and then disregard them; it did not read them at all, and the page it took was not disallowed. That distinction — never read versus read and ignored — is the one this observatory's <a href="/questions/do-ai-crawlers-respect-robots-txt">compliance measurement</a> is built to preserve, and this is the first live instance of the first case.</p>

<h2>Limits</h2>

<ul>
<li><strong>n = 1.</strong> One fetch, one assistant, one page. Nothing here generalises to how this client behaves at large.</li>
<li>The user agent is a claim. It is corroborated here by the connecting infrastructure and by the correct marker appearing in the assistant's reply, but it is not cryptographically verified.</li>
<li>"No JavaScript executed" is established for this visit by the absence of any beacon request. The client also never fetched the page that carries the script, so this is evidence about this fetch, not a capability claim about the client.</li>
<li><strong>This is evidence of retrieval, not of training ingestion.</strong> The marker was reported because the page was open at that moment. Whether it persists in a model is a separate measurement, and the relevant column on the <a href="/lab">lab page</a> remains empty.</li>
</ul>
`
  },

  {
    id: "F-004",
    slug: "one-handset-ten-countries",
    date: "2026-07-27",
    title:
      "The most thorough reader of this site declares itself a 2019 handset, from ten countries at once",
    summary:
      "One user agent string — a consumer iPhone running iOS 13.2.3, released November 2019 — has made 222 requests to this site from 168 distinct addresses in ten countries, averaging 1.32 requests per address. It has taken 49 distinct paths, read robots.txt, taken no disallowed path, executed no script and never asked whether anything had changed. It is the only client that has fetched all three pages published here on 27 July. A single handset is one device in one place; the shape is the part that cannot be reconciled with the declaration.",
    body: `
<h2>What was observed</h2>

<p>Between 25 July 11:22:49 UTC and 27 July 17:42:48 UTC, 222 external requests arrived
carrying one identical user agent string:</p>

<pre><code>Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15
(KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1</code></pre>

<p>iOS 13.2.3 was released in November 2019. The string describes one consumer handset.</p>

<table>
<thead><tr><th>How many</th><th>Of what</th></tr></thead>
<tbody>
<tr><td>222</td><td>requests</td></tr>
<tr><td>168</td><td>distinct connecting addresses</td></tr>
<tr><td>10</td><td>countries the addresses geolocate to</td></tr>
<tr><td>49</td><td>distinct paths taken</td></tr>
<tr><td>1.32</td><td>requests per address, on average</td></tr>
<tr><td>45</td><td>addresses used more than once — never more than three times</td></tr>
</tbody>
</table>

<p>The addresses geolocate to US (95 requests), SG (26), DE (22), KR (16), BR (16),
JP (15), HK (14), CN (9), TH (5) and ID (4).</p>

<h2>How it behaves</h2>

<table>
<thead><tr><th>How many requests</th><th>Did what</th></tr></thead>
<tbody>
<tr><td>3</td><td>fetched <a href="/robots.txt">robots.txt</a></td></tr>
<tr><td>1</td><td>fetched <a href="/sitemap.xml">sitemap.xml</a></td></tr>
<tr><td>0</td><td>took a path listed under <code>Disallow</code></td></tr>
<tr><td>0</td><td>asked whether anything had changed (no conditional request)</td></tr>
<tr><td>0</td><td>executed the script on <a href="/probe/js">the JavaScript probe</a></td></tr>
</tbody>
</table>

<p>Three pages were first published here on 27 July. This client fetched all three, and
is the only one that has:</p>

<table>
<thead><tr><th>Page</th><th>First fetched by this client</th><th>Anything earlier</th></tr></thead>
<tbody>
<tr><td><a href="/verify">/verify</a></td><td>80 minutes after publication</td><td>a mobile browser, at 45 minutes</td></tr>
<tr><td><a href="/cdn-interventions">/cdn-interventions</a></td><td>266 minutes</td><td>a desktop browser, at 16 minutes</td></tr>
<tr><td><a href="/weekly/2026-W31">/weekly/2026-W31</a></td><td>342 minutes</td><td>nothing — no other client has fetched it</td></tr>
</tbody>
</table>

<h2>What the shape establishes</h2>

<p>A consumer handset is one device. It holds one address at a time, changes address when
its network changes, and is in one country. It does not appear in Singapore, Germany,
Korea, Brazil, Japan, Hong Kong, China, Thailand and Indonesia over three days while
averaging 1.32 requests from each of 168 addresses.</p>

<p>That average is the part worth reading twice. Traffic spread this thinly leaves no
address looking busy: examined one address at a time, every one of these is an
unremarkable visitor who loaded a page or two. The pattern exists only when the requests
are grouped by what they declared, which is the one field nobody has to tell the truth in.</p>

<p><strong>The declaration and the behaviour disagree, and only the declaration is under
the client's control.</strong> That is the entire finding.</p>

<h2>What it does not establish</h2>

<p>Not who sent these requests. Not what they were for. Not whether one party or several
arranged it. A request carries no field for intent and this site does not infer one.</p>

<p>Nor does it establish misconduct. This client read the rules and took no path it was
asked to leave alone — <strong>every disallowed page on this site remains unfetched by
anyone</strong>, and this client is part of that record rather than an exception to it.
A false declaration and a violated rule are different things, and only the first is
present here.</p>

<p>The politeness is worth stating plainly because it is the intuition most likely to
mislead. A reader who learns "well-behaved crawlers are the genuine ones" has learned a
rule this record contradicts: the most rule-abiding client here is also the one whose
declaration its own shape refuses.</p>

<h2>Limits</h2>

<ul>
<li><strong>No attribution.</strong> The address blocks are not resolved to an operator here. Doing so would mean citing a registry lookup taken at one moment as though it were part of the record, and this site publishes what it observed. The shape is established; who owns it is not.</li>
<li>Country codes are geolocations of connecting addresses reported by the CDN. They say where a packet entered the network, not where anybody is.</li>
<li><strong>One site, three days, 222 requests.</strong> This is a description of what happened here. It supports no rate, no proportion, and no claim about how common this pattern is on the web.</li>
<li>"Executed no script" is established by the absence of any beacon request. This client also never fetched the page carrying the script, so it is evidence about these visits rather than a capability claim.</li>
<li>The user agent is the only thing linking these 222 requests into one client. If two unrelated systems happened to send byte-identical strings, this describes their sum. Nothing in the record can separate them, and nothing here assumes it can.</li>
</ul>
`
  }
];
