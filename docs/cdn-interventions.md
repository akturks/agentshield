# What the CDN did to this site, and when it stopped

This site publishes claims about bytes. It says every client receives the same bytes for the same
URL, that recorded user agents are printed verbatim, and that its `robots.txt` welcomes the crawlers
it exists to observe. Those claims are about **what a reader receives**, and the origin server is not
the last thing to touch that.

On 2026-07-27 the whole sitemap was fetched through the CDN and diffed against the origin, for the
first time. Five interventions were found. Two had already been worked around in code without being
understood. Three were unknown. This file records what was measured, how, and what it changes.

Nothing here is an accusation of intent. Every item is a byte-level difference between what this
server sent and what a client received.

## When

The two dashboard settings were switched off part-way through the investigation. The record bounds
the moment but does not pin it:

| | Time (UTC) |
|---|---|
| Injection last confirmed **present** — all 35 HTML pages, self-audit crawl | `2026-07-27T02:46:22Z` |
| Injection first confirmed **absent** | `2026-07-27T06:31:24Z` |

Anything measured before `02:46` was measured through the interventions below. Anything after `06:31`
was not. The ~3h45m in between is unresolved and should be treated as such.

**When the interventions *started* is unknowable from this record.** The origin only stores what it
sent. Cloudflare's additions have no history here. They were present for at least the whole
investigation and may have been present since the zone was created; the site has existed for two
days. Do not date them.

## The five

| # | What | Effect | Resolution |
|---|---|---|---|
| 1 | Email Address Obfuscation | rewrote a **recorded observation** | worked around in code |
| 2 | `robots.txt` edge caching | served a stale file with a `max-age` the origin never sent | fixed in code |
| 3 | **`robots.txt` content injection** | told 9 crawler groups `Disallow: /` | **switched off** |
| 4 | **HTML body injection ("AI Labyrinth")** | hidden link to a decoy page, on every HTML page | **switched off** |
| 5 | `ETag` and `Content-Length` stripped from HTML | conditional requests impossible for HTML | **unresolved** |

---

### 1. A recorded observation was rewritten in transit

`/lab` prints user agents exactly as they arrived. One of them contains an address:

```
Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)
```

Readers received `ClaudeBot/1.0; [email protected]` with a decoder script injected. The page
asserting that agents are "recorded verbatim and counted as-is" was serving an altered observation,
and it was invisible from inside the application — this server sent the correct bytes every time.

Worked around in `layout.js` with `recorded()`, which wraps the value in Cloudflare's documented
`<!--email_off-->` opt-out. **The feature itself was never switched off**, so the wrapper stays: it
is the only thing standing between the record and the rewriter if the setting returns.

### 2. `robots.txt` was cached at the edge

Served with `cf-cache-status: HIT`, `age: 3740`, under a `max-age=14400` this server never sent. A
crawler reading the rules was reading a copy up to four hours old. Fixed in `robots.js` with
`Cache-Control: no-store`; now `BYPASS`.

### 3. The site told the crawlers it studies not to come

The worst of the five.

```
origin: 1468 bytes      edge: 3304 bytes
```

Cloudflare **prepended** a block to `robots.txt`:

```
# BEGIN Cloudflare Managed content
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: Amazonbot
Disallow: /
User-agent: meta-externalagent
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: CloudflareBrowserRenderingCrawler
Disallow: /
# END Cloudflare Managed Content
```

Nine user-agent groups: eight AI crawlers and the CDN's own browser-rendering
crawler. An earlier version of this file said eight and omitted the last one;
corrected 2026-07-27 by recounting the captured response.

Directly beneath it, unchanged, was the file this project wrote:

```
# AI crawlers and agents are welcome here.
# This site measures how AI systems read the web; blocking them would defeat it.
```

Two contradictory groups for the same tokens, in one document, in two different voices — one of them
not ours. Which group a crawler honoured is unknown and unknowable from here.

Declared-crawler traffic recorded during the period, excluding the impostor address `45.45.237.206`:

| Agent | Requests | Addresses | Disallowed-path fetches |
|---|---|---|---|
| GPTBot | 7 | 3 | 0 |
| ClaudeBot | 4 | 2 | 0 |
| CCBot | 1 | 1 | 0 |
| Bytespider | 1 | 1 | 0 |

Thirteen requests over two days. **That figure cannot be read as crawler behaviour.** It may be a
measurement of an instruction this site did not issue. Whether it changes now that the block is gone
is the open experiment; the answer will be in the record within days, and it is a real result either
way.

Three GPTBot fetches of disallowed paths appear in the raw record. All three carry an empty
`cfConnectingIp`, meaning they never traversed the CDN — local tests from before the tunnel, not a
crawler. No genuine declared crawler has fetched a disallowed path.

### 4. A hidden decoy link in every HTML page

Injected immediately after `<body>` on all 35 HTML pages:

```html
<a href="https://agentshieldaidefense.com/cdn-cgi/content?id=…"
   aria-hidden="true" rel="nofollow noopener"
   style="display: none !important; visibility: hidden !important"></a>
```

`+287` or `+288` bytes, with an `id` that changed on every request. The endpoint returns a
machine-generated essay — `<title>The Labyrinth of Knowledge: An Odyssey into Epistemology</title>`
on one fetch, `Atomic Physics: Unveiling the Mysteries of the Microcosm` on the next — marked
`noindex,nofollow`, containing no outbound links. A single decoy, not a maze. Following it is a
signal, and the signal it produces is "this client is a bot".

**It was conditional on the user agent**, which is what makes it a violation rather than a nuisance:

| Client | Injected |
|---|---|
| Desktop browser | yes |
| Googlebot | yes |
| curl | yes |
| no user agent | yes |
| python-requests | yes |
| unrecognised bot | yes |
| **GPTBot** | **no** |
| **ClaudeBot** | **no** |

The population this site exists to observe most closely — clients that do not declare a recognised
identity — were the ones handed a hidden link to an endpoint the origin never sees. `/cdn-cgi/*`
returns `200` and has **zero recorded requests** in `reality.db`.

This falsified Article V in both its title and its text: *Observation does not alter the observed*,
*No content is varied by user agent*. It was false on the compliance instrument itself, and it was
false in the direction that mattered most.

The canary marker was identical for every client on every page, so **ingestion measurement is
unaffected**. That is the one thing this did not touch.

#### A note on the name

Cloudflare's own dashboard assistant stated repeatedly that "AI Labyrinth is not a product or feature
available in your Cloudflare dashboard or in the current Cloudflare documentation" — while the zone
was serving a page with *Labyrinth* in its title. The name was first inferred from behaviour,
withdrawn on the assistant's authority, and then confirmed by fetching the page.

That sequence is this project's own thesis arriving from an unexpected direction: **a vendor's
self-report about its own product is not evidence about that product's behaviour.** The measurement
settled it; the documentation did not.

### 5. `ETag` and `Content-Length` are stripped from HTML — unresolved

Every `text/html` response loses both. Nothing else does.

| Content type | gzip | `ETag` survives |
|---|---|---|
| `text/html` (incl. 404, incl. `HEAD`) | yes | **no** |
| `application/rss+xml` | yes | yes |
| `application/json` | yes | yes |
| `application/xml` | yes | yes |
| `text/plain` | yes | yes |
| `text/markdown` | no | yes |

Ruled out by measurement: compression (compressed non-HTML keeps its tag, uncompressed markdown keeps
its tag), the injection in §4 (removed; bytes now identical; tag still absent), response status, and
request method. No header is added to HTML that is absent from other types.

What remains is that an HTML-only rewriter is engaged at the edge with nothing to show for itself:
bytes are unchanged because it finds nothing to change, but `Content-Length` is dropped — the
signature of a component that streams the body rather than passing it through.

**Which feature it is has not been established.** Email Address Obfuscation (§1, never switched off)
is the obvious candidate and is a guess. It cannot be tested from outside: the site contains exactly
one email address and it sits inside the opt-out wrapper, and no page reflects query input into HTML.
Confirming it needs either the dashboard or a page written to be rewritten — and this site's standing
rule is to remove pages rather than add them.

Consequence: **conditional requests cannot be measured on HTML.** They work today on `.json`, `.md`,
`.txt` and `.xml`, which is enough surface to ask the question. The `validator.js` comment anticipated
this outcome before it happened, and it stands:

> An intermediary deciding what politeness a client is allowed to practise is worth recording as a
> finding in its own right.

---

## What this falsifies, and what it does not

**Falsified while it lasted:**

- Article V, *Observation does not alter the observed* — §4, by user agent, on every HTML page.
- `/lab`'s "recorded verbatim and counted as-is" — §1.
- The `robots.txt` commentary describing what this site asks of crawlers — §3 served a second,
  contradictory set of rules in a voice that was not this site's.

**Not falsified:**

- **No published figure is withdrawn.** The compliance question page publishes no rate — "the record
  is too new to report rates" — so no compliance claim was ever made on the contaminated sample.
- Canary markers were byte-identical for every client, so time-to-ingestion is unaffected.
- Every observation in `reality.db` is what arrived. None of these interventions touched ingestion;
  they altered what left, not what came in.

**Weakened:** any reading of declared-crawler volume before `2026-07-27T02:46Z` as evidence about
crawler behaviour. Thirteen requests under an injected `Disallow: /` measures an unknown mixture of
crawler policy and a rule this site did not write.

## Reproducing this

```sh
# §3 — robots.txt, origin against edge
curl -s http://127.0.0.1:8080/robots.txt -H "Host: agentshieldaidefense.com" | wc -c
curl -s https://agentshieldaidefense.com/robots.txt | wc -c
curl -s https://agentshieldaidefense.com/robots.txt | grep -c "Cloudflare Managed"

# §4 — HTML injection, any page
curl -s https://agentshieldaidefense.com/constitution | grep -c 'cdn-cgi/content'

# §5 — which content types keep a validator
for p in /constitution /feed.xml /probe/data.json /probe/data.md /robots.txt; do
  printf "%-20s " "$p"
  curl -s -D- -o /dev/null "https://agentshieldaidefense.com$p" | grep -ci '^etag:'
done

# the whole sitemap, origin against edge — the check that found all of this
curl -s https://agentshieldaidefense.com/sitemap.xml | grep -oE '<loc>[^<]*' | sed 's|<loc>||'
```

## The lesson, which is not new here

*A verification whose evidence comes from the party being checked is not a verification.* This
project recorded that four times on 2026-07-26, each time about a language model. It applies without
modification to the infrastructure the site runs on, and to the site's own claims about itself: the
application had no way to know, because from inside the application nothing was wrong.

An integrity check that fetches a page through the CDN and diffs it against the local render would
catch this entire class. It has been offered twice and is still not built. Until it exists, the diff
above is a manual step, and this file is the only place it is recorded.
