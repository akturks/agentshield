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
  },
  {
    id: "F-005",
    slug: "same-501-bytes-fourteen-sites",
    date: "2026-07-28",
    // The instant it was actually written. See seed.js — the date-only form
    // stamps midday, which for a finding published this morning would date the
    // conclusion four hours ahead of the survey it came from.
    publishedAt: "2026-07-28T07:40:00.000Z",
    title:
      "Fourteen sites served the same 501 bytes of robots.txt, and the bytes name who wrote them",
    summary:
      "A declared sample of 400 domains was asked for its robots.txt on 28 July 2026. 198 answered with one. Fourteen of those files contain 1,834 bytes that are identical across all fourteen, at the same offset — but only 501 of them sit inside the comment marking what the delivery network inserted. The marked part refuses eight AI crawlers. The 1,333 unmarked bytes before it are a legal notice, written in the site's own voice, asserting terms as a condition of access and reserving rights under EU copyright law. In none of the fourteen does the text outside the marked block name any of those crawlers, so nothing was overruled: the decision appears in a file the owner publishes and is absent from everything the owner wrote.",
    body: `
<h2>Correction, 28 July 2026 08:20 UTC</h2>

<p><strong>This finding was published at 07:40 UTC stating that 501 identical bytes appear in fourteen files. The figure was right and it was not the whole insertion.</strong> Checked afterwards: in all fourteen files the marked block begins at byte 1,334, and <strong>the 1,333 bytes before it are also identical across all fourteen</strong>. So 1,834 bytes are the same in every file, and the comment marking what was inserted encloses 501 of them — 27%.</p>

<p>The unmarked 1,333 bytes are not rules. They are a legal notice, and they are written in the first person of the website:</p>

<blockquote><p>As a condition of accessing this website, you agree to abide by the following content signals&hellip;</p>
<p>ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.</p></blockquote>

<p>Between those two paragraphs it defines what <code>search</code>, <code>ai-input</code>, <code>ai-train</code> and <code>use</code> mean — the vocabulary of the <code>Content-Signal</code> line that appears inside the marked block.</p>

<p>What this changes: the earlier text counted those 1,333 bytes as the site's own, because the boundary comment says the insertion starts after them. It does not change any figure below. The preamble names no crawler, which is checked directly in the evidence chain, so the contradiction count is still zero.</p>

<p>What it adds is the sharper version of the same observation. A file that states terms of access and reserves rights under copyright law, in a site's own voice, sits outside the marker that identifies what the site did not write. Whether that boundary is meant to delimit rules rather than prose is not knowable from a fetched file; what is measurable is that a reader following the marker attributes those bytes to the site.</p>

<h2>What was observed</h2>

<p>Between 07:04:29 and 07:14:29 UTC on 28 July 2026, this site requested <code>/robots.txt</code> once from each of 400 domains. The population is a published ranking with a permanent identifier and the sample is a fixed stride through it, so the same 400 domains can be derived by anyone. <a href="/survey">The method, the rate and the terms</a> were written down before the first request.</p>

<table>
<thead><tr><th>Result</th><th>Domains</th></tr></thead>
<tbody>
<tr><td>Asked</td><td>400</td></tr>
<tr><td>Answered</td><td>272</td></tr>
<tr><td>Did not answer</td><td>128</td></tr>
<tr><td>Answered with a robots.txt</td><td>198</td></tr>
<tr><td>Answered with something else, usually an HTML error page under status 200</td><td>74</td></tr>
<tr><td>Answers delivered through Cloudflare, by its own response header</td><td>95</td></tr>
<tr><td><strong>Files carrying an inserted block</strong></td><td><strong>14</strong></td></tr>
</tbody>
</table>

<p>Fourteen of the 198 files — 7.1% of the files, 14.7% of the answers that came through that network — contain a section delimited by <code># BEGIN Cloudflare Managed content</code> and its closing comment. <strong>All fourteen sections are identical byte for byte:</strong> 501 bytes, ten user-agent groups, in the same order, on sites that share nothing else in this sample.</p>

<p>Nine of the ten groups name a crawler and refuse it with <code>Disallow: /</code>. Eight of those nine are AI crawlers; the ninth is the network's own browser-rendering crawler. The tenth group is not a refusal at all — it applies to every client, allows the whole site, and carries a <code>Content-Signal</code> line stating a policy about training and reuse. That is a different kind of sentence: it asks to be honoured rather than blocking a request, and it is counted separately here rather than added to the eight.</p>

<h2>What was not found</h2>

<p><strong>Not one of the fourteen files contradicts itself.</strong> A contradiction would be an inserted <code>Disallow</code> for a crawler that the site's own section names and allows, and in this sample there are none — because in all fourteen cases the site's own text never mentions those crawlers at all. There was nothing there to overrule.</p>

<p>This survey was built to count contradictions, having found one on this site: <a href="/cdn-interventions">the origin file here welcomes those crawlers by name while the edge refused them</a>. Naming an AI crawler in order to permit it turns out to be unusual. Across 198 files it did not happen once.</p>

<p>The weaker result is the published one. What the sample supports is narrow and worth stating on its own terms: fourteen sites publish a decision about eight AI crawlers that appears nowhere in anything they wrote.</p>

<h2>What it means</h2>

<p>A robots.txt is read as a statement by the site. It is the one file whose entire purpose is to say what its publisher permits, and every automated client that respects it treats it that way. In these fourteen cases part of that statement was composed elsewhere, and the file says so — the network signs its own insertion with a comment, which is the only reason this is measurable at all.</p>

<p>Byte-for-byte identity across fourteen unrelated sites is the part that needs no argument. Fourteen people writing their own rules do not produce the same 1,834 bytes in the same order, starting at the same offset.</p>

<p>Separately, 20 sites in the sample refuse an AI crawler in their own text with no insertion involved — more than the fourteen. Those are decisions somebody wrote down, and they are counted apart for exactly that reason.</p>

<h2>Limits</h2>

<ul>
<li><strong>Nobody's intent was measured, and none is claimed.</strong> Whether these fourteen operators enabled this deliberately, inherited it as a default, or would recognise it if shown, is invisible from outside. A file that publishes a rule its owner did not type is evidence of that and of nothing further. The one case where the operator did not know is this site, which is a sample of one and is us.</li>
<li><strong>No domain is named.</strong> Reporting how many sites carry a rule they did not write is a measurement; reporting which ones is a list of other people's configurations published without an opportunity to object.</li>
<li><strong>An insertion that does not announce itself is invisible to this method.</strong> One network labels its additions, and that is the one this counts. A rewrite with no marker would read as the owner's own text here, and this page would have no way of knowing.</li>
<li><strong>Reachability was measured from one place.</strong> 128 domains did not answer, including twenty that reset the connection and also failed to resolve in DNS — filtering between this machine and them rather than those sites being down. A domain that did not answer is never counted as a domain without a robots.txt.</li>
<li><strong>Only a bare <code>Disallow: /</code> counts as a refusal.</strong> Narrower rules are real and are not a closed door; counting them would inflate every figure above.</li>
<li><strong>A wildcard is not a decision about a named crawler.</strong> A file saying <code>User-agent: *</code> has not decided anything about GPTBot, and is counted as not having mentioned it.</li>
<li><strong>400 domains, one morning, one sample.</strong> 7.1% is a proportion of this sample and not an estimate for the web. A second run drawn the same way would land somewhere near it or would not, and that is a question for a second run.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>This site spent three days measuring what crawlers did to it, and then found that the file it used to invite them had been answering on its behalf. The obvious question is how far that extends, and it is answerable without asking anybody, because the intervention labels itself.</p>

<p>The answer is smaller than the question. That is the result, and it is published at the size it came in.</p>
`
  },
  {
    id: "F-006",
    slug: "rules-and-map-never-the-pages",
    date: "2026-07-28",
    publishedAt: "2026-07-28T09:55:00.000Z",
    title:
      "Eight requests from OpenAI's two automated crawlers asked only for the rules and the map",
    summary:
      "Between 25 and 27 July 2026, requests declaring OAI-SearchBot arrived here six times from five addresses on three separate days, and every one of them asked for /robots.txt. Requests declaring GPTBot arrived twice and both asked for /sitemap.xml. Neither crawler has fetched a single page of this site's content. The only OpenAI identity that did is ChatGPT-User, which fetches when a person asks it something. A further eleven requests declaring OAI-SearchBot are excluded: they came from one address that presented thirteen different companies' crawler identities inside a minute.",
    body: `
<h2>What was observed</h2>

<p>Three OpenAI crawler identities have reached this site. Their requests separate cleanly, and the separation is the finding.</p>

<table>
<thead><tr><th>Declared identity</th><th>Requests</th><th>Addresses</th><th>Days</th><th>What it asked for</th></tr></thead>
<tbody>
<tr><td><code>OAI-SearchBot</code></td><td>6</td><td>5</td><td>3</td><td><code>/robots.txt</code>, every time</td></tr>
<tr><td><code>GPTBot</code></td><td>2</td><td>1</td><td>2</td><td><code>/sitemap.xml</code>, both times</td></tr>
<tr><td><code>ChatGPT-User</code></td><td>2</td><td>2</td><td>1</td><td><code>/</code> and <code>/questions</code></td></tr>
</tbody>
</table>

<p><strong>Requests declaring OAI-SearchBot or GPTBot have never asked for a page of this site's content — not once in eight requests across three days.</strong> They asked for the file that states the rules and the file that lists the pages, and stopped there.</p>

<p>Twice, the two arrived together. On 26 July a request for <code>/robots.txt</code> was followed 52 seconds later by a request for <code>/sitemap.xml</code> from a different address; on 27 July the two arrived in the same second. Both addresses fall inside ranges OpenAI publishes, and they are not the same range.</p>

<h2>What is excluded, and why</h2>

<p>A further <strong>eleven</strong> requests declared <code>OAI-SearchBot</code> and are left out of every figure above. All eleven came from one address which, in a single minute, also presented twelve other companies' crawler identities while requesting <code>/.env</code>, <code>/.git/config</code> and sixty other credential paths. <a href="/findings/identity-rotation-2026-07-26-4545237206">That incident is its own finding.</a></p>

<p>Including them would have produced the opposite result — the same identity would appear to read source control and configuration files eagerly. A user agent is a string the sender chooses, and a habit attributed without checking the address is a habit attributed to whoever last borrowed the name.</p>

<h2>What it means</h2>

<p>Being read by an AI crawler and being read at all are different events, and this record separates them for one company over three days. The crawlers that arrive on their own schedule took the rules and the index. The pages were fetched only when a person asked a question and an agent went to look — a different mechanism, a different identity, and one request each time.</p>

<p>For anyone measuring whether AI systems see their site, that distinction matters more than a visit count. Eight arrivals from OpenAI's infrastructure look like attention. None of them read a sentence of what is here.</p>

<h2>What this does not establish</h2>

<p>Four readings of the same observation remain, and the record separates only two of them. <a href="/lab#open-questions">All four are published with the observation that would settle each.</a></p>

<ul>
<li><strong>Delegation is supported.</strong> Content <em>was</em> fetched from OpenAI's infrastructure — under ChatGPT-User, twice.</li>
<li><strong>Refusal is contradicted.</strong> This site's <code>robots.txt</code>, read back from what the network actually delivers rather than from the code that generates it, welcomes these crawlers by name.</li>
<li><strong>"Not yet" is open.</strong> Three days settles nothing about a longer horizon.</li>
<li><strong>"This is what the crawler is for" is open, deliberately.</strong> It could be closed by consulting OpenAI's documentation, and a company's account of its own crawler is not evidence about that crawler's behaviour here.</li>
</ul>

<h2>Limits</h2>

<ul>
<li><strong>Eight requests over three days, on one site.</strong> This is what happened here. It supports no rate, no proportion, and nothing about how these crawlers behave on any other domain.</li>
<li>Corroboration means the connecting address falls inside a range OpenAI publishes, checked against a dated snapshot rather than a live fetch. It establishes that the request came from that infrastructure, and nothing about what any system did afterwards.</li>
<li>This site is four days old, small, and mostly about crawlers. A crawler's behaviour here need not resemble its behaviour on a large site with ordinary content.</li>
<li>The site publishes a <code>Crawl-delay</code> of 10 seconds and several major crawlers document that they ignore it. Nothing above depends on whether it was honoured.</li>
<li><strong>Absence is not refusal.</strong> That a page was never fetched in three days does not establish that it will not be, and no sentence here should be read as saying so.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>The question this site exists to answer is whether AI systems read the web, and the usual proxy for it is whether their crawlers show up. Here they showed up eight times and read nothing — which is only visible because the requests were kept whole, with the path attached, and because eleven requests wearing the same name were checked against an address list before being counted.</p>
`
  },
  // WITHDRAWN 2026-07-28T11:36:46Z, six minutes after publication, by the
  // operator. Kept here rather than deleted: the store holds the withdrawal and
  // its reason, and removing the source would leave a rejected row nobody could
  // read the text of.
  //
  // The reason was not an error in the figures — all nine claims verified and
  // still do. It was the order. The headline led with the unresolved half (no
  // request arrived from one assistant, and why is not established) while the
  // half that was finished sat underneath it: a model quoting a figure this
  // record holds to the second. Held until the network provider's event log for
  // the same window has been read.
  //
  // `publishedAt` below was originally written as 11:40:00, a rounded value, and
  // the row was actually seeded at 11:30:14.800. That put the takedown six
  // minutes *before* the publication in the public table. Corrected in the store
  // to the instant the claims were verified, which is when the finding existed.
  // A publication instant on this site is the zero point of the ingestion
  // measurement; rounding one up is not a cosmetic slip.
  {
    id: "F-007",
    slug: "one-morning-three-assistants",
    date: "2026-07-28",
    publishedAt: "2026-07-28T11:30:14.800Z",
    title:
      "109 requests reached this site in one morning, and none came from the assistant that was asked to open it",
    summary:
      "Between 00:00 and 11:30 UTC on 28 July 2026 this site answered 109 external requests. Two came from Claude-User, which read robots.txt and then the home page; one from OAI-SearchBot; seven from Google's crawlers. None declared ChatGPT-User. In the same hours, two assistants asked about this site produced summaries of it and a third reported that it could not retrieve the site at all — while citing a different domain, with a tag showing that its own fetching had worked. One of the summaries quoted a figure that appears only on the live home page, and the record holds that exact figure at that exact instant.",
    body: `
<h2>What was observed</h2>

<p>All figures below cover <strong>00:00 to 11:30 UTC on 28 July 2026</strong>, a closed window, and come from requests recorded as they arrived.</p>

<table>
<thead><tr><th>Declared identity</th><th>Requests</th></tr></thead>
<tbody>
<tr><td>All external clients</td><td>109</td></tr>
<tr><td><code>Google-InspectionTool</code>, <code>Googlebot</code>, <code>GoogleOther</code></td><td>7</td></tr>
<tr><td><code>Claude-User</code></td><td>2</td></tr>
<tr><td><code>OAI-SearchBot</code></td><td>1</td></tr>
<tr><td><strong><code>ChatGPT-User</code></strong></td><td><strong>0</strong></td></tr>
</tbody>
</table>

<p>The last request declaring <code>ChatGPT-User</code> reached this site on 25 July. None arrived on the morning described here, during which an assistant was asked more than once to open this address.</p>

<h2>The one chain that closed</h2>

<p>At <strong>11:09:39 UTC</strong> a client declaring <code>Claude-User</code> requested <code>/robots.txt</code>. One and a half seconds later it requested the home page and received 28,597 bytes. The rules first, then the page.</p>

<p>The home page prints a running count of external requests. <strong>The record holds exactly 999 external requests before that fetch</strong>, so the page delivered to that client said 999 — a page cannot count the request that is fetching it.</p>

<p>Minutes later, an assistant's summary of this site quoted <strong>999 external requests</strong>.</p>

<p>That is the first complete chain this site has been able to show: a request in the record, a figure on the page that request received, and the same figure in a model's output — each of the three checkable against the other two, and the off-by-one explained rather than explained away.</p>

<h2>What was reported</h2>

<p>Two things below were not observed here. They are what somebody else's system displayed, recorded with who said it and when, and nothing is concluded from them.</p>

<ul>
<li><strong>Google's AI mode produced a summary of this site</strong>, citing more than one page of it, and described it as an independent observatory of how AI systems read the web rather than as a security product. Observed by the operator in Google's interface on 28 July.</li>
<li><strong>An assistant reported that it could not retrieve this site</strong>, and in the same exchange cited a different domain whose URL carried <code>utm_source=chatgpt.com</code> — a tag that is added when that assistant fetches a page. Its fetching worked; it was not pointed here.</li>
</ul>

<h2>What it means</h2>

<p>Three AI systems, one site, one morning, three different outcomes. Two produced accurate summaries. The third sent no request at all, and said it could not reach a site that had answered a request from its own company's search crawler at 10:01 the same morning.</p>

<p>Being reachable is not the same as being retrieved, and being retrieved by one vendor says nothing about another. The chain that closed here shows what the full path looks like when it works — request, page, output — and the value of measuring it is that each link can be checked separately when it does not.</p>

<h2>What this does not establish</h2>

<p><strong>Why no request arrived is not known, and no cause is claimed.</strong> At least three readings survive this record:</p>

<ul>
<li>The assistant's retrieval step was never pointed at this address, because its search step resolved the site's name to other projects sharing it.</li>
<li>Something between that assistant and this server refused the request before it arrived. That would leave no trace in this record and would appear in the network provider's own event log, which has not been inspected.</li>
<li>The request was made and failed for a reason neither side recorded.</li>
</ul>

<p>These are distinguishable, and the observation that separates them is the CDN's event log for the same window. Until it has been read, the honest statement is the narrow one: <em>no request arrived.</em></p>

<h2>Limits</h2>

<ul>
<li><strong>One morning, one site, 109 requests.</strong> This describes a window. It supports no rate and nothing about how these systems behave elsewhere or on other days.</li>
<li><strong>Two of the four events are reports.</strong> What an assistant displayed is that party's output, recorded verbatim with a date. It is not evidence, and this finding does not rest on it — the chain that closed rests on a request, a byte count and a stored figure.</li>
<li>The 999 match is one instance. It shows that this particular summary was drawn from the live page rather than from a cache or a memory, and it shows nothing about any other summary.</li>
<li><strong>Absence of a request is not refusal.</strong> Nothing above establishes that any system will not fetch this site, only that one did not during these hours.</li>
<li>Corroboration of <code>Claude-User</code> is not possible here: Anthropic publishes no machine-readable list of its crawler addresses, so the identity of that client rests on the declared user agent and its address, and neither is verified.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>Most attempts to measure whether an AI system reads a site end at "did a crawler arrive". This morning shows why that is too coarse: a crawler arrived, a second system produced a correct summary from a live page, and a third reported the site unreachable — all within ninety minutes, all true.</p>

<p>The part worth keeping is not that one assistant failed. It is that the failure and the success were both measurable, from the same record, in the same window.</p>
`
  },

  // F-008 replaces the withdrawn F-007 rather than restoring it. The slug
  // `one-morning-three-assistants` stays rejected; rejection here is permanent.
  //
  // Two things changed between the withdrawal and this entry, and both are why
  // it is publishable now. The CDN event log for the window was read, which
  // eliminates the reading that something in between refused the request. And
  // the addresses were put through the dated vendor snapshot, which showed that
  // requests declaring three OpenAI identities are corroborated — so the
  // absence is specific to one identity, not to a vendor.
  //
  // The order is deliberate: what was eliminated first, the open question last.
  // Leading with an unresolved question was the reason the previous entry came
  // down.
  {
    id: "F-008",
    slug: "answered-two-hundred-every-time",
    date: "2026-07-28",
    title:
      "Every request declaring an OpenAI identity was answered 200, and none has declared the browsing agent since 25 July",
    summary:
      "Eleven requests declaring one of three OpenAI identities are in this record, each corroborated against a dated snapshot of that vendor's published addresses, and every one was answered 200. None was refused, redirected or rate-limited. The CDN's event log for the last 24 hours contains a single block, of an address that appears nowhere in this record and is not on any OpenAI list. Requests declaring the browsing agent stop on 25 July and have not resumed, while an assistant asked repeatedly to open this address reported that it could not. Nothing measurable from this side accounts for that.",
    body: `
<h2>What was tested</h2>

<p>An assistant given this domain directly did not open it. Everything below was run to find out whether the cause was here. Each of these is an action taken by the operator, not an observation of anyone else's behaviour, and none of it is offered as evidence of what any AI system does — only of what this server does when asked.</p>

<table>
<thead><tr><th>Checked</th><th>Result</th></tr></thead>
<tbody>
<tr><td>DNS, apex and <code>www</code></td><td>A and AAAA records both answer</td></tr>
<tr><td>Response to a plain request</td><td><code>HTTP/2 200</code>, no redirect</td></tr>
<tr><td><code>x-robots-tag</code> header</td><td>Absent</td></tr>
<tr><td><code>&lt;meta name="robots"&gt;</code></td><td>Absent</td></tr>
<tr><td>Canonical URL</td><td>Points at this origin</td></tr>
<tr><td><code>/robots.txt</code></td><td>Serves; refuses none of these agents</td></tr>
<tr><td>Home page requested under three declared identities</td><td>All <code>200</code>; <strong>one distinct byte count</strong> between them</td></tr>
<tr><td>Search console: crawl, fetch, index</td><td>Allowed, successful, indexed</td></tr>
<tr><td>CDN security event log, 24 hours</td><td><strong>One block</strong> — see below</td></tr>
</tbody>
</table>

<p>The three identities in the seventh row were sent from the operator's own address at 10:22 UTC on 28 July. They received the same page, byte for byte. That is the point of the row: nothing here varies its answer by who is asking.</p>

<h2>The one block</h2>

<p>The CDN recorded exactly one blocked request in twenty-four hours, at <strong>03:10:46 UTC</strong>, from <code>192.241.139.213</code>, by a managed rule.</p>

<p>That address is on no OpenAI address list in the snapshot this site checks against, and it appears <strong>zero</strong> times in this record — consistent with a request stopped before it reached the origin. Its neighbours in the same minutes were scanners: automated probes for <code>/wp-admin/install.php</code> and cloud addresses declaring a mobile browser.</p>

<p>This matters for one reason. A security event log records <em>actions taken</em>, not requests received; an allowed request leaves no row there. So an empty log would have proved nothing on its own. What closes the question is the pair — nothing refused at the edge, <em>and</em> nothing arrived at the origin — because those are two independent records that would fail in different ways.</p>

<h2>What the record holds</h2>

<p>All figures cover the record from its first entry to 11:30 UTC on 28 July, excluding one address that presented thirteen different identities and is therefore not evidence of any of them.</p>

<table>
<thead><tr><th>Declared identity</th><th>Requests</th><th>Corroborated</th><th>Answered other than 200</th></tr></thead>
<tbody>
<tr><td><code>OAI-SearchBot</code></td><td>7</td><td>yes</td><td>0</td></tr>
<tr><td><code>GPTBot</code></td><td>2</td><td>yes</td><td>0</td></tr>
<tr><td><code>ChatGPT-User</code></td><td>2</td><td>yes</td><td>0</td></tr>
</tbody>
</table>

<p>Corroborated here means the connecting address falls inside a range published by that vendor, as captured in a dated snapshot held in this repository. The snapshot is never refreshed at detection time, so this check reproduces.</p>

<p>Both requests declaring <code>ChatGPT-User</code> arrived on <strong>25 July</strong>, the second at 11:31:54.541 UTC. <strong>None has been recorded since</strong> — not on 26, 27 or 28 July, across the three days on which an assistant was asked to open this address.</p>

<p>Across all seven requests declaring <code>OAI-SearchBot</code>, <strong>one distinct path</strong> was requested: <code>/robots.txt</code>. The most recent was at 10:01:17 UTC on 28 July, ninety minutes before an assistant reported this site unreachable. The rules were read that morning. The pages were not.</p>

<h2>The chain that closed</h2>

<p>At 11:09:39 UTC a client requested <code>/robots.txt</code>, and 1.15 seconds later the home page, receiving <strong>28,597 bytes</strong>. The home page prints a running count of external requests, and the record holds exactly <strong>999</strong> before that fetch — so the page delivered to that client said 999, because a page cannot count the request that is fetching it.</p>

<p>Minutes later an assistant's summary of this site quoted 999.</p>

<p>Three links, each checkable against the other two: a request in the record, a figure on the page that request received, and the same figure in a model's output, with the off-by-one explained rather than explained away.</p>

<p>Separately, at 10:43:09.980 and 10:43:10.705 UTC, two requests declaring <code>Google-InspectionTool</code> were answered with 28,562 bytes each. The search console reported its inspection at the same second.</p>

<h2>What it means</h2>

<p>Reachability and retrieval are different properties, and only one of them is controllable from a server.</p>

<p>Every question that can be answered from this side has been answered the same way: the site responds, to everyone, identically, with no refusal at any layer, and the vendor whose assistant reported it unreachable has infrastructure that reached it — corroborated — on the same morning. What did not happen is that a request was made by the part of that system which reads pages on a user's behalf.</p>

<p>A cause that produces no request produces no evidence, anywhere the operator can look. That is not a gap in this measurement; it is the boundary of what server-side measurement can see, and knowing exactly where that boundary sits is worth more than a guess about what lies past it.</p>

<h2>What this does not establish</h2>

<p><strong>Why no request arrived is not known, and no cause is claimed.</strong> Of the three readings this site listed before the CDN log was read, one is now eliminated:</p>

<ul>
<li><s>Something between that assistant and this server refused the request.</s> <strong>Eliminated.</strong> One block in twenty-four hours, of an unrelated address, and nothing missing from the origin record.</li>
<li>The retrieval step was never pointed at this address, because the name resolves to other projects that share it. <strong>Untested here</strong>, and the only one of the three that could be tested from outside that system.</li>
<li>A request was attempted and failed before leaving that system's own network. <strong>Not observable from here</strong>, by anyone but its operator.</li>
</ul>

<h2>Limits</h2>

<ul>
<li><strong>One site, one name, four days.</strong> This supports no rate and describes no other domain. A site whose name is unambiguous might show none of this.</li>
<li><strong>Eleven corroborated requests is a small number.</strong> It is enough to say every one was answered 200, which is a count. It is not enough to say anything about frequency.</li>
<li>The vendor snapshot is dated 26 July 2026. An address added after that date would read as uncorroborated here, which would understate arrivals rather than overstate them.</li>
<li><strong>The assistant's own account of its limitation is a report, not an observation.</strong> It is recorded on <a href="/discovery">the discovery page</a> with its date, in the column for things this site did not measure, and nothing above rests on it. A statement from the party being examined cannot verify a claim about that party.</li>
<li><strong>Absence of a request is not refusal.</strong> Nothing here establishes that any system will not fetch this site, only that requests declaring one identity were not recorded during these days.</li>
<li>Identification of <code>Claude-User</code> is not possible here: no machine-readable list of those addresses is published, so that client rests on a declared user agent and an uncorroborated address. The 999 chain does not depend on which vendor it was.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>"My site does not appear in AI answers" is the question a site owner actually asks, and the usual advice — check robots.txt, check your headers, check indexing — assumes the answer is on the owner's side. Here it was not, and it took nine checks and two independent logs to establish that with something better than an opinion.</p>

<p>The useful output is not a fix. It is a boundary: everything inside it was measured and cleared, and what remains is outside any instrument an operator controls. Most diagnoses stop before drawing that line and leave the owner changing things that were never wrong.</p>
`
  },

  // F-009 was written because the operator looked at this site's own console,
  // saw 1,160 requests in 24 hours, and asked whether the site was under
  // attack. It was not. But the question was the right one to ask of the
  // number, because 77% of it was one address for three minutes.
  //
  // The security half of this is the boring half and is stated in a table. The
  // half worth publishing is what a three-minute scan does to a denominator,
  // on a site whose entire output is figures computed from this record.
  {
    id: "F-009",
    slug: "three-minutes-that-owned-a-day",
    date: "2026-07-28",
    title:
      "893 requests in three minutes became 77% of a day's traffic, and obtained four files anyone can read",
    summary:
      "Between 11:39:38 and 11:42:49 UTC on 28 July 2026 a single address sent 893 requests asking for 884 distinct paths. 889 were answered 404. The four that were not returned the home page, robots.txt, llms.txt and the sitemap — the files this site publishes for anyone. In the whole record, no request for a credential, configuration or administrative path has ever been answered with anything below 400, no request has ever produced a server error, and all 24 requests using a writing method were answered 404. The finding is not the scan. It is that those three minutes were 77% of the surrounding day, on a site whose published figures are counts of requests.",
    body: `
<h2>What was observed</h2>

<p>One address, one wordlist, 191 seconds.</p>

<table>
<thead><tr><th>Measure</th><th>Count</th></tr></thead>
<tbody>
<tr><td>Requests from this address</td><td>893</td></tr>
<tr><td>Distinct paths asked for</td><td>884</td></tr>
<tr><td>Answered <code>404</code></td><td>889</td></tr>
<tr><td>Answered below 400</td><td><strong>4</strong></td></tr>
<tr><td>Seconds from first request to last</td><td>191</td></tr>
</tbody>
</table>

<p>Roughly 4.7 requests a second, essentially none of them repeated. The paths asked for name the software this site does not run: a WordPress installer, a <code>.env</code> file, CI definitions for three different systems, container build files, four mail-server configurations, an API schema.</p>

<p>The four requests that were answered asked for <code>/</code>, <code>/robots.txt</code>, <code>/llms.txt</code> and <code>/sitemap.xml</code>. Those are the four files this site publishes specifically so that anything arriving can read them. Nothing was obtained that a first-time visitor does not receive.</p>

<h2>What the whole record says about that</h2>

<p>The figures below are not about this scan. They cover every external request this site has recorded since it began serving.</p>

<table>
<thead><tr><th>Across the whole record</th><th>Count</th></tr></thead>
<tbody>
<tr><td>Requests for a credential, configuration or administrative path answered below 400</td><td><strong>0</strong></td></tr>
<tr><td>Requests answered with a server error</td><td><strong>0</strong></td></tr>
<tr><td>Requests using a writing method — <code>POST</code>, <code>PUT</code>, <code>PATCH</code>, <code>DELETE</code></td><td>24</td></tr>
<tr><td>How many of those were answered with anything other than <code>404</code></td><td><strong>0</strong></td></tr>
</tbody>
</table>

<p>The zero in the second row is worth a sentence of its own. At 4.7 requests a second across 884 misses, nothing fell over, which is a property of serving pages that were computed before the request arrived rather than during it.</p>

<h2>The part that is actually a finding</h2>

<p>In the 24 hours ending with that scan's last request, this site recorded <strong>1,159</strong> external requests. <strong>893 of them — 77% — were that one address during those three minutes.</strong></p>

<p>This site publishes counts of requests. It reports how many arrived, from how many addresses, declaring which identities, on which paths. Every one of those figures has a denominator, and for one day that denominator was three-quarters one scanner.</p>

<p>No published figure here was distorted by it, for a reason worth naming: the figures published earlier that day were bounded by a window that closed at 11:30 UTC, nine minutes before the scan began. That was not foresight about this scan. It is what closing a window does — it fixes what a number can still be affected by, and a number nobody can move afterwards is the only kind that can be rechecked.</p>

<p>The operator's own dashboard, which is not bounded that way, showed the spike as a day's traffic. That is what prompted the question this finding answers.</p>

<h2>What it means</h2>

<p>Anyone measuring how AI systems read their site is counting requests, and the counts are small. A site receiving a few hundred requests a day can have a single automated sweep supply most of a week's total, and every rate computed from that total — crawler share, paths per visit, requests per agent — moves with it while looking entirely ordinary.</p>

<p>The defence is not to exclude scanners; deciding what counts as one is a judgement, and a judgement applied to a record quietly is how a record stops being a record. The defence is that a published figure names its window and can be recomputed, so that when the shape of a day is strange the strangeness is visible rather than absorbed.</p>

<h2>What this does not establish</h2>

<ul>
<li><strong>No claim is made about who sent this or why.</strong> An address geolocates; it does not attribute. The declared user agent was an ordinary desktop browser string, which is worth exactly nothing as identification.</li>
<li>Scanning a public site for known software is constant background on the internet. Nothing here says this one was targeted, and the first automated probe of this domain arrived under two minutes after it began resolving.</li>
<li><strong>Zero successful requests to sensitive paths is a statement about paths that were asked for.</strong> It says every attempt recorded here failed. It is not an assurance that no attempt could succeed, and no such assurance is available from a request log.</li>
</ul>

<h2>Limits</h2>

<ul>
<li><strong>One scan, one site, one day.</strong> The 77% is a property of this day's traffic and supports no rate.</li>
<li>The classification of a path as "sensitive" is a pattern match written by the operator, listed in the query published with this finding. A path it does not match would not appear in that count.</li>
<li>Requests refused at the CDN never reach this record. What is counted here is what arrived, and one further request was blocked upstream in the same 24 hours — from an unrelated address, recorded in the provider's log rather than this one.</li>
<li>This is the first address in the record to send 500 or more requests. One instance is not a pattern, and nothing here predicts how often this recurs.</li>
</ul>

<h2>Why this was worth recording</h2>

<p>The question that produced this finding was "are we under attack?", asked of a number on a dashboard. The answer was no. The better answer is that the number could not tell you either way, because it had no window, and a count without a window is a rumour with a decimal point.</p>

<h2>Correction — 28 July 2026, 12:16 UTC</h2>

<p>This finding was published carrying two claims recorded as failures, and the page rendered the word "mismatch" for about the time it took to read this paragraph. No figure in it was wrong.</p>

<p>The two claims counted requests by HTTP method, and their queries named <code>DELETE</code>. The verifier refuses any claim query containing that word anywhere, including inside quotation marks, because a claim able to modify the record it checks against would defeat the point of checking. So the queries were never run: they were rejected, and a rejected query is stored the same way as a figure that disagreed — no observed value, marked not ok.</p>

<p>They have been rewritten to count the same rows without naming the method — <code>method NOT IN ('GET','HEAD')</code> — and both now return what the text above says, 24 and 0.</p>

<p>A second guard on this site failed the same way in the same hour, and it is worth putting beside the first. The rule that no finding may cite something we did is enforced by looking for the names of the action tables, one of which is <code>Config</code>. The claim counting requests for sensitive paths asks for <code>path LIKE '%config%'</code>, and the check read that as a citation. It reads the observation record and cites nothing.</p>

<p>Only one of those two guards has been changed. Deciding whether to run a query should stay crude, because a false positive there costs a rewrite and a false negative lets a claim edit the record it is checking. Deciding whether a finding is honest should not be crude, because a false positive there marks a sound finding as a violation and nothing on the other side needs protecting. The second now matches those names only where a table can appear.</p>

<p>Two things were wrong here and only one of them was the query.</p>

<p>The first is that the page published at all. The check meant to prevent this reads only findings generated by a detector, and it asks whether <em>any</em> figure matched rather than whether <em>none</em> failed. Both exemptions applied to this finding at once. A seventh integrity check now covers every published finding regardless of who wrote it, and fails on a single claim that did not hold.</p>

<p>The second is that a query which could not be evaluated and a figure which was recomputed and disagreed are stored identically. Only one of those means a finding is wrong, and this record cannot currently tell them apart. That is recorded here as a known defect rather than fixed quietly.</p>
`
  }
];
