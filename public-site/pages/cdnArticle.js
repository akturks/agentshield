import { page } from "../layout.js";

// The site's first long-form piece, and the reason it lives here rather than on a
// publishing platform: the finding is the site's own, the figures it quotes are
// recomputed on /lab as requests arrive, and a reader who doubts a number is one
// click from the live version. Hosting it elsewhere would have sent the crawling
// that the piece is partly about to somebody else's domain.
//
// Written as HTML rather than markdown on purpose. `renderMarkdown` is a closed
// subset that covers what `arch` emits — no links, no emphasis, no blockquotes —
// and widening a deliberately closed renderer to publish one essay would be the
// wrong trade. Every other prose page here is built the same way.
//
// The technical record it draws on is `docs/cdn-interventions.md`, committed
// separately, and this page links to it rather than restating it. The essay is
// allowed to be an essay; the record has to stay a record.
export function cdnArticle(canary, published) {
  const body = `
<h1>I built a site to watch AI crawlers. My CDN was quietly turning them away.</h1>

<p class="lede">Five things sat between what my server sent and what anybody
received. I found them by accident, and only because a number looked wrong.</p>

<p>Before you read any further, run this against your own domain. It takes ten
seconds, and you may want the answer before you finish this sentence:</p>

<pre><code>curl -s https://your-domain/robots.txt | grep -c "Managed content"</code></pre>

<p>Anything other than zero means something is writing rules for your site that you
did not write.</p>

<hr>

<p>This is that site. One domain, thirty-nine pages, a database that records every
request that arrives — the address, the user agent, every header, verbatim. The
question is narrow on purpose: <em>how do AI systems actually read the web?</em> Not
what the vendors say they do. What arrives at the door.</p>

<p>Everything below is a claim about bytes, and you should be able to fetch them
yourself. <a href="/lab">The live figures</a> update as requests arrive.
<a href="/findings">The findings</a> each carry the query that produced them. If I
have this wrong, the material to prove it is public.</p>

<p>The site publishes what it finds, and it publishes <a href="/constitution">its own
rules</a>. One of those rules says:</p>

<blockquote><p>Every client receives identical bytes for the same URL.</p></blockquote>

<p>Another says the crawlers are welcome, because a site built to observe them and
then blocking them would be pointless.</p>

<p>Both of those statements were false. Not because my server was wrong — it sent
exactly what I told it to. They were false because a claim about bytes is a claim
about <strong>what a reader receives</strong>, and the origin server is not the last
thing to touch them.</p>

<h2>The thread I pulled</h2>

<p>I had just added <code>ETag</code> headers so I could measure whether AI crawlers
make conditional requests — whether they ask "has this changed?" before downloading a
page again. It is a politeness question and a bandwidth question, and nobody
publishes real numbers on it.</p>

<p>The header worked locally. It never reached the internet.</p>

<p>I assumed compression. It was not compression. I assumed a caching setting. It was
not that either. I predicted the fix three times and was wrong three times, which is
usually the point where you stop theorising and start measuring.</p>

<p>So I fetched a page from my own server, fetched the same page through the CDN, and
compared the bytes.</p>

<pre><code>origin: 11,670 bytes
edge:   11,958 bytes</code></pre>

<p>Two hundred and eighty-eight bytes I did not write.</p>

<h2>What was in them</h2>

<pre><code>&lt;a href="https://agentshieldaidefense.com/cdn-cgi/content?id=…"
   aria-hidden="true" rel="nofollow noopener"
   style="display: none !important; visibility: hidden !important"&gt;&lt;/a&gt;</code></pre>

<p>A hidden link, injected immediately after <code>&lt;body&gt;</code>, with an
<code>id</code> that changed on every single request. Invisible to a human. Perfectly
visible to anything parsing HTML.</p>

<p>I followed it. It returns a machine-generated essay. On one fetch the title was
<em>The Labyrinth of Knowledge: An Odyssey into Epistemology</em>. On the next fetch
of the same URL: <em>Atomic Physics: Unveiling the Mysteries of the Microcosm</em>.
Marked <code>noindex, nofollow</code>. No outbound links. Generated at the edge — my
server has never recorded a single request for that path, and the path returns
<code>200</code>.</p>

<p>It is a decoy. Following it is a signal, and the signal it produces is
<em>this client is a bot</em>.</p>

<p>Then I checked who got it.</p>

<div class="scroll"><table>
<thead><tr><th>Client</th><th>Received the injection</th></tr></thead>
<tbody>
<tr><td>Desktop browser</td><td>yes</td></tr>
<tr><td>Googlebot</td><td>yes</td></tr>
<tr><td>curl</td><td>yes</td></tr>
<tr><td>No user agent at all</td><td>yes</td></tr>
<tr><td>python-requests</td><td>yes</td></tr>
<tr><td>Unrecognised bot</td><td>yes</td></tr>
<tr><td><strong>GPTBot</strong></td><td><strong>no</strong></td></tr>
<tr><td><strong>ClaudeBot</strong></td><td><strong>no</strong></td></tr>
</tbody></table></div>

<p>The content varied by user agent. On a site whose stated rule is that content does
not vary by user agent — and, worse, on the exact instrument built to measure whether
<em>other people</em> serve different content to crawlers.</p>

<p>The population this site exists to observe most carefully is the one that does
<strong>not</strong> declare a recognised identity. Those were precisely the clients
being handed a hidden trapdoor.</p>

<h2>Then I looked at robots.txt</h2>

<p>This is the one that matters.</p>

<pre><code>origin: 1,468 bytes
edge:   3,304 bytes</code></pre>

<p>My file, the one in my repository, opens like this:</p>

<pre><code># AI crawlers and agents are welcome here.
# This site measures how AI systems read the web; blocking them would defeat it.</code></pre>

<p>The file that actually left the edge opened differently. Above my text, prepended, was a
block I did not write:</p>

<pre><code># BEGIN Cloudflare Managed content

User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /

User-agent: Amazonbot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: CloudflareBrowserRenderingCrawler
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

# END Cloudflare Managed Content</code></pre>

<p>Nine user-agent groups, every one of them told to leave. Directly above my own
paragraph inviting them in.</p>

<p>One document. Two voices. Opposite instructions. One of the voices was not
mine.</p>

<h2>So how much crawler traffic did I actually get?</h2>

<p>Sixty external requests arrived claiming one of the AI crawler identities this site
checks for. That number looks like data until you ask where it came from.</p>

<div class="scroll"><table>
<thead><tr><th>&nbsp;</th><th>Requests</th></tr></thead>
<tbody>
<tr><td>Claimed an AI crawler identity</td><td>60</td></tr>
<tr><td>…of which came from <strong>one single address</strong></td><td><strong>49 (81.7%)</strong></td></tr>
<tr><td>…from the other eight addresses</td><td>11</td></tr>
</tbody></table></div>

<p>One machine, presenting six different companies' crawler identities, produced four
fifths of my AI crawler traffic. It was not crawling. It spent six seconds hunting for
<code>.env</code>, <code>.git/config</code> and <code>.aws/credentials</code>, found
nothing, and left — and it wore those identities because a great deal of
infrastructure waves GPTBot through a filter it would stop anything else at.</p>

<p>Which leaves eleven requests, across eight addresses, in two days.</p>

<p>Every one of those claims is checked against the address ranges each vendor
publishes for its own crawler. Across all sixty:</p>

<ul>
<li><strong>7 corroborated</strong> — the request came from inside the vendor's published range</li>
<li><strong>30 contradicted</strong> — the vendor publishes a list and this address is not on it</li>
<li><strong>23 uncheckable</strong> — no machine-readable list exists to check against</li>
</ul>

<p>That last row is not an accusation of anybody. Anthropic and Common Crawl publish
nothing you can verify against, so every one of their agents lands there however
genuine it is. A vendor's silence must never be rendered as a client's guilt.</p>

<p>And the percentages are close to meaningless on their own, because
<strong>one incident supplied four fifths of the sample</strong>. I am saying that in
the same breath as the numbers, because a figure that hides its own dominant
contributor is worse than no figure. <a href="/lab#checked">The live version</a>
recomputes all of it, including what share the largest single address currently
holds.</p>

<p>So: eleven requests that were not the impostor, over two days, from the crawlers of
the largest AI companies in the world, at a site expressly built to be read by
them.</p>

<p>I had been reading that as <em>crawler behaviour</em>. It may be nothing of the
kind. It may be a measurement of an instruction I never issued.</p>

<p>I cannot tell you which, and that is the honest answer. I can tell you the block is
gone now, and that the same number over the coming weeks will settle it.</p>

<h3>Stop here for a second, because this part is not about me</h3>

<p>I noticed this because measuring what reaches clients is the entire purpose of this
site. I had a database of every request, a habit of comparing origin bytes against
served bytes, and three days of paranoia about self-reported evidence.</p>

<p>You almost certainly have none of that, and you have the same CDN or one very like
it.</p>

<p>If your business depends on being found — by a search engine, by an AI assistant,
by anyone who reads pages instead of looking at them — then the file that tells those
systems what they may read is the single most consequential text you publish. It is
also the one nobody ever opens again after the day they write it.</p>

<p>Mine was rewritten. I found out on day three, by accident, while investigating
something else entirely.</p>

<h2>And the ETag, finally</h2>

<p>Once the injection stopped, the bytes matched — origin and edge, identical, every
page. The <code>ETag</code> still did not come through.</p>

<div class="scroll"><table>
<thead><tr><th>Content type</th><th>gzip</th><th>ETag survives</th></tr></thead>
<tbody>
<tr><td><code>text/html</code> (incl. 404s, incl. <code>HEAD</code>)</td><td>yes</td><td><strong>no</strong></td></tr>
<tr><td><code>application/rss+xml</code></td><td>yes</td><td>yes</td></tr>
<tr><td><code>application/json</code></td><td>yes</td><td>yes</td></tr>
<tr><td><code>application/xml</code></td><td>yes</td><td>yes</td></tr>
<tr><td><code>text/plain</code></td><td>yes</td><td>yes</td></tr>
<tr><td><code>text/markdown</code></td><td>no</td><td>yes</td></tr>
</tbody></table></div>

<p>Compression is ruled out — compressed non-HTML keeps its validator, and
uncompressed markdown keeps its validator too. The injection is ruled out; it is gone
and the bytes are identical. Status is ruled out; a 404 loses it too. Method is ruled
out; <code>HEAD</code> loses it too.</p>

<p>The only variable left is <code>Content-Type: text/html</code>, which also loses its
<code>Content-Length</code> — the signature of a component that streams the body
rather than passing it through. Something is still parsing my HTML at the edge and
finding nothing to change.</p>

<p><strong>I do not know which feature it is.</strong> I have a guess and I am not
going to print it as a cause, because a guess printed as a cause is exactly the
failure this whole project exists to avoid.</p>

<p>The practical consequence: conditional requests remain unmeasurable on HTML, and
measurable on everything else.</p>

<h2>A short note about names</h2>

<p>While investigating, I asked the CDN's own dashboard assistant what was injecting
content into my pages. It told me, more than once, that the feature I was describing
did not exist in my dashboard or in the current documentation.</p>

<p>At the time I accepted that and withdrew the name I had inferred from the
behaviour.</p>

<p>Then I fetched the injected URL, and the page it returned had <em>Labyrinth</em> in
its title.</p>

<p>I do not think anyone was lying to me. I think a support system genuinely could not
find a feature that was running on the zone it was inspecting. But the sequence is
worth sitting with, because it is this project's entire thesis arriving from an
unexpected direction:</p>

<blockquote><p>A vendor's self-report about its own product is not evidence about that
product's behaviour.</p></blockquote>

<p>I wrote that sentence about language models. It turned out to be about my own
infrastructure.</p>

<h2>What I am not claiming</h2>

<p>Every one of these is a documented product feature, not a defect. Some are things a
lot of site owners actively want — I can easily imagine wanting a decoy page for
unidentified scrapers, and plenty of publishers very much want <code>Disallow: /</code>
in front of AI training crawlers. That is a legitimate choice.</p>

<p>I am not claiming malice. I am not claiming anyone was hiding anything.</p>

<p>I am claiming three narrower things:</p>

<ul>
<li><strong>I did not switch these on, and I did not know they were on.</strong> They were defaults on a zone I had barely configured.</li>
<li><strong>They changed what I published</strong>, in a direction opposite to my stated intent, on the one property where that intent was the entire point.</li>
<li><strong>Nothing inside my application could have detected it.</strong> The logs were clean. The tests passed. The server sent the right bytes every time. The alteration happened after the last line of code I control.</li>
</ul>

<p>And one thing I genuinely cannot establish: <strong>when it started.</strong> My
origin only records what it sent. The CDN's additions have no history on my side. They
were present for the whole investigation and may have been present since the day the
zone was created. I am not going to date them, and you should distrust anyone who
dates theirs.</p>

<h2>The full check</h2>

<p>You ran the first one at the top. Here are the other three.</p>

<pre><code># Is something prepended to your robots.txt?
curl -s https://your-domain/robots.txt | grep -c "Cloudflare Managed"

# Is something injected into your HTML?
curl -s https://your-domain/ | grep -c 'cdn-cgi/content'

# Does your validator survive the trip?
curl -sI https://your-domain/ | grep -i '^etag:'</code></pre>

<p>And the one that found all of it — fetch a page from your origin and through your
CDN, and diff the bytes. If they differ and you did not ask them to, that difference
is being served to every reader you have, including the machines that decide what your
site is about.</p>

<h2>The part that generalises</h2>

<p>I spent three days building an instrument to check whether AI systems tell the
truth about what they read. The instrument worked. It just took me until day three to
point it at the thing standing between me and everyone I was measuring.</p>

<p>The lesson has nothing to do with any particular CDN, and I would have found the
same class of problem behind any of them:</p>

<blockquote><p>A verification whose evidence comes from the party being checked is not
a verification.</p></blockquote>

<p>We have quietly accepted an arrangement in which almost everything we believe about
our own systems is self-reported by those systems. The application says it served the
right bytes. The dashboard says the setting is off. The support assistant says the
feature does not exist. The analytics panel says these are the pages people want. The
model says it does not remember your site.</p>

<p>Each of those is a party describing its own conduct. Not one of them is evidence.
And they are not usually wrong — which is exactly what makes them dangerous, because a
source that is right ninety-nine times teaches you to stop checking on the
hundredth.</p>

<p>The gap between what you publish and what is received is not a CDN problem. It is
the general shape of the thing: every layer you did not write is a layer that can
answer for you, and every layer you did not write will tell you it did not.</p>

<p>There is only one class of evidence that does not come from an interested party — an
independent observation, taken from outside, dated, and repeatable by someone who does
not trust you either.</p>

<p>So the practical version of all this is much smaller than the principle, and you can
do it this afternoon: <strong>fetch your own site from outside, compare it to what you
meant to send, and write down the date you looked.</strong></p>

<p>The only thing that is not a self-report is the bytes, measured from outside, by
you.</p>

<hr>

<div class="qa">
<p>The full technical record — every measurement, every reproduction command, and what
this does and does not falsify — is committed at
<a href="https://github.com/akturks/agentshield/blob/main/docs/cdn-interventions.md">docs/cdn-interventions.md</a>.</p>

<p><a href="/lab">The lab page</a> carries every figure quoted above, live. Those
counts can be inflated: anyone can send requests claiming to be GPTBot, and this site
does not refuse them, because refusing traffic would change what the instrument can
measure. What cannot be inflated is the corroborated column — reaching it requires
sending from the vendor's own published addresses. So if the injected
<code>Disallow: /</code> was suppressing genuine crawlers, you will be able to watch
that number move over the coming weeks without taking my word for any of it. That is
the only kind of proof this article is entitled to offer.</p>

<p>If you run the checks on your own domain and find something,
<a href="/about#contact">I would like to hear about it</a>.</p>

<p>The code here was written with Claude, on an architecture and a set of rules that
predate it. What to measure, what could be concluded from it, and what had to be
thrown away were my calls — the repository's history shows which is which, including
where I was wrong.</p>
</div>
`;

  return page({
    title: "I built a site to watch AI crawlers. My CDN was quietly turning them away.",
    description:
      "Five measured alterations between what an origin server sent and what clients received, including a robots.txt block that told nine AI crawlers to leave — prepended by the CDN, not by the site.",
    path: "/cdn-interventions",
    canary,
    published,
    schemaType: "Article",
    body
  });
}
