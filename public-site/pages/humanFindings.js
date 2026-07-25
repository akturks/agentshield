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
  }
];
