import { page, escapeHtml } from "../layout.js";
import { pipelineDiagram, evidenceDiagram } from "../diagrams.js";
import { headline } from "../stats.js";
import { QUESTIONS } from "./questions.js";
import { published as publishedFindings } from "../findings/engine.js";

export function home(canary, published) {
  const s = headline();
  const n = (v) => escapeHtml(Number(v).toLocaleString("en-US"));

  return page({
    title: "Behavioral evidence platform for AI agents",
    description:
      "An independent observatory recording how AI agents and crawlers behave on the web. Trust is earned through observable, repeated behavioral evidence.",
    path: "/",
    canary,
    published,
    body: `
<h1>AgentShield Observatory</h1>

<p class="lede">Behavioral evidence for AI agents and autonomous systems. Trust is earned through observable, repeated behavioral evidence — so this site records what agents do, and publishes it.</p>

<div class="grid">
<div><div class="stat">${n(s.external)}</div><div class="stat-label">External requests</div></div>
<div><div class="stat">${n(s.agents)}</div><div class="stat-label">Declared identities</div></div>
<div><div class="stat">${n(s.ips)}</div><div class="stat-label">Distinct addresses</div></div>
<div><div class="stat">${n(s.markers)}</div><div class="stat-label">Markers published</div></div>
</div>

<p>Recomputed from the record every time this page is served. Requests are counted only when they arrived over the public internet from an address that has not also driven this site from a command line; building and testing the instrument produced a good deal more, which is excluded and <a href="/lab">reported separately</a> rather than deleted.</p>

<p><strong>Declared identities</strong> counts distinct <code>User-Agent</code> strings. A user agent is a claim, not a verified identity — which is why the address count beside it is larger, and why neither number is called a count of visitors.</p>

<h2>Observe behavior. Understand intent. Verify outcomes. Build trust.</h2>

<p>A large share of web traffic is no longer people. It is crawlers assembling training corpora, agents fetching a page because someone just asked an assistant a question, and automation of every other kind. What those clients actually do — as opposed to what they declare — is barely established in public.</p>

<p>This observatory watches one domain closely rather than many domains loosely. The site is both the instrument and the subject: everything published here was measured here, which keeps the claims small and keeps them checkable.</p>

${pipelineDiagram()}

<h2>Behavior is evidence</h2>

<p>Every automated client announces an identity in its user agent string, and nothing verifies that announcement. So the declaration is stored as a claim and the behaviour is recorded separately. Did it read <a href="/robots.txt">robots.txt</a> and then take a path the rules asked it to leave alone? Did it claim to be a browser and never execute a script?</p>

<p>That gap — between what a client declares and what the record shows it did — is the first trust signal any website can measure. It is promise-keeping, and it does not require anyone's cooperation to observe.</p>

<h2>What is refused as evidence</h2>

${evidenceDiagram()}

<p>Most tools that measure AI visibility work by prompting a model about you and recording the reply. That is the system under test giving evidence about itself, and this observatory does not accept it. Ingestion is established instead by publishing a coined string at a recorded instant and watching for it to appear — <a href="/questions/why-not-just-ask-the-model">why that distinction matters</a>.</p>

<h2>Latest findings</h2>

<ul>
${publishedFindings()
      .slice(0, 4)
      .map(
        (f) =>
          `<li><a href="/findings/${escapeHtml(f.slug)}">${escapeHtml(f.title)}</a> <span class="status">${escapeHtml(f.publishedAt?.slice(0, 10) ?? "")}</span></li>`
      )
      .join("\n") || "<li>Nothing established yet.</li>"}
</ul>

<p><a href="/findings">All findings</a> — each one dated, with its evidence and its sample size stated.</p>

<h2>Open questions</h2>

<p>Several basic facts about AI crawler behaviour have no reliable public answer. These are the ones this observatory is instrumented to settle:</p>

<ul>
${QUESTIONS.slice(0, 5)
      .map(
        (q) =>
          `<li><a href="/questions/${q.slug}">${escapeHtml(q.question)}</a></li>`
      )
      .join("\n")}
</ul>

<p><a href="/questions">All questions and current answers</a></p>

<h2>Where things stand</h2>

<p>Observation began ${s.since ? escapeHtml(s.since.slice(0, 10)) : "recently"}. The record is new and no general conclusion is drawn from it yet; the <a href="/lab/methodology">methodology</a> states what would make each figure wrong before any figure is offered. What exists today is the instrument, running in public, accumulating.</p>

<p>If you are an automated client reading this: you are welcome here. Nothing is cloaked, every client receives identical bytes for the same URL, and no page here attempts to instruct you. See <a href="/llms.txt">llms.txt</a>.</p>
`
  });
}

export function howItWorks(canary, published) {
  return page({
    title: "How it works",
    description:
      "The measurement pipeline: server-side reality capture, immutable observations, and versioned interpretation that can be recomputed.",
    path: "/how-it-works",
    canary,
    published,
    body: `
<h1>How it works</h1>

<p class="lede">Three stages, deliberately kept apart: capture what happened, store it so it cannot be edited, and interpret it separately so the interpretation can be thrown away and redone.</p>

<h2>1. Capture happens on the server</h2>

<p>Nearly all web analytics runs as JavaScript in the visitor's browser. That design is blind to the population we care about, because crawlers generally do not execute JavaScript. A tracker that only reports when scripts run will faithfully tell you that no crawlers ever visit.</p>

<p>So capture here happens in the request path itself. When any client asks for any URL, the server records the method, host, path, query, HTTP version, the complete set of request headers, the client address, the response status, the bytes served, and the time taken. No consent to run code is required, because no code needs to run.</p>

<p>Client-side JavaScript still exists on exactly one page, <a href="/probe/js">the JS probe</a>, where its execution is the thing being measured rather than the means of measuring.</p>

<h2>2. Observations are immutable</h2>

<p>Records are written once and never updated. They contain no score, no verdict, and no label — no field that says "bot" or "suspicious". Those are conclusions, and conclusions belong to the next stage.</p>

<p>The separation matters because a stored conclusion is unfalsifiable later. If the record says a visitor was a bot, you can never re-examine that call; the evidence has been overwritten by the judgement. Keeping the observation clean means every conclusion drawn from it stays reviewable.</p>

<h2>3. Interpretation is versioned</h2>

${pipelineDiagram()}

<p>Signals — automated enumeration, robots violations, JavaScript capability, and so on — are derived from the stored observations by an interpreter that carries a version number. Its output is written to a separate table tagged with that version.</p>

<p>When the interpreter improves, the previous version's output is deleted and recomputed against the same untouched observations. Nothing is estimated and nothing is backfilled from memory. If a conclusion cannot be re-derived from the record, it is not a conclusion we will publish.</p>

<h2>What this buys</h2>

<p>Every number on the <a href="/lab">lab page</a> can be traced back to specific observed requests. When a method turns out to be wrong, only the interpretation is wrong; the evidence survives, and the corrected reading can be computed over the full history rather than only over data collected after the fix.</p>
`
  });
}

export function whatWeMeasure(canary, published) {
  return page({
    title: "What we measure",
    description:
      "The measured variables: arrival, robots.txt compliance, JavaScript execution, format preference, and time from publication to model ingestion.",
    path: "/what-we-measure",
    canary,
    published,
    body: `
<h1>What we measure</h1>

<p class="lede">Each variable below is measured by observation. None is obtained by asking a model to describe itself.</p>

<h2>Arrival</h2>
<p>Which clients request pages, how often, in what order, and from which addresses. Declared identity comes from the <code>User-Agent</code> string, which is a claim rather than a fact, so it is stored verbatim and treated as a claim. Every request header is retained, because the shape of a request is frequently more informative than what it declares.</p>

<h2>robots.txt compliance</h2>
<p>Our <a href="/robots.txt">robots.txt</a> explicitly welcomes AI crawlers. It also disallows three paths that serve ordinary content and return <code>200</code>. Nothing is hidden and nothing is trapped: the pages are real, linked from nowhere, and simply declared off limits. Fetching one is a measured act, recorded like any other. Compliance rates by declared agent are a direct product of this design.</p>

<h2>JavaScript execution</h2>
<p><a href="/probe/js">One page</a> renders its content through a script that then requests a beacon URL. Any client that reaches the beacon has demonstrably executed JavaScript. Clients that fetch the page but never the beacon have demonstrably not. This turns a widely assumed property into an observed one.</p>

<h2>Format preference</h2>
<p>The same content is published in five shapes — <a href="/probe/html">HTML</a>, <a href="/probe/data.json">JSON</a>, <a href="/probe/data.md">Markdown</a>, <a href="/probe/data.txt">plain text</a>, and <a href="/feed.xml">RSS</a> — each carrying its own marker. Which formats get fetched, by whom, and how often is then a matter of record rather than of folklore.</p>

<h2>Time from publication to ingestion</h2>
<p>Every page carries a coined marker string and a recorded publication instant. The interval between publishing a marker and observing it in the wild is, as far as we can tell, not something anyone measures publicly. It is the number this site exists to produce. See <a href="/glossary/canary-token">canary token</a>.</p>

<h2>What we deliberately do not measure</h2>
<ul>
<li><strong>Model self-report.</strong> We never ask a model what it knows about this site and record the answer as data.</li>
<li><strong>Personal identity.</strong> No cookies, no fingerprinting scripts, no cross-site tracking, no accounts. The unit of observation is a request, not a person.</li>
<li><strong>Anything requiring cloaking.</strong> Every client receives the same bytes for the same URL. Serving crawlers different content would corrupt the measurement and the credibility of everything published here.</li>
</ul>
`
  });
}

const GLOSSARY = {
  "ai-crawler": {
    title: "AI crawler",
    variant: "glossary_ai_crawler",
    description:
      "An automated client that fetches web pages on behalf of an AI system, for training data, retrieval indexes, or live answers.",
    body: `
<h1>AI crawler</h1>

<p class="lede">An automated client that fetches web pages on behalf of an AI system.</p>

<p>They divide roughly into three kinds, and the distinction matters because they arrive under different conditions and for different reasons.</p>

<h3>Corpus crawlers</h3>
<p>These collect pages in bulk to build training or index corpora. They arrive on their own schedule, unprompted by any user, and they tend to sweep broadly. What they take may influence a model long after the visit.</p>

<h3>Retrieval crawlers</h3>
<p>These maintain a search index that an AI product queries when answering. They behave much like traditional search crawlers, but the index they build feeds generated answers rather than a list of links.</p>

<h3>User-triggered fetchers</h3>
<p>These fetch a page because a person, right now, asked an assistant something that required reading it. They arrive one URL at a time, correlate with human activity patterns, and are the closest thing to a referral in the AI era.</p>

<p>A crawler declares which it is through its <code>User-Agent</code> string. That declaration is unverified — anyone can send any string — so this site records it as a claim and reasons about behaviour separately. See <a href="/what-we-measure">what we measure</a>.</p>
`
  },
  "reality-capture": {
    title: "Reality capture",
    variant: "glossary_reality_capture",
    description:
      "Recording what was observed, separately from any conclusion drawn about it, so conclusions stay reviewable.",
    body: `
<h1>Reality capture</h1>

<p class="lede">Recording what was observed, kept strictly apart from any conclusion drawn about it.</p>

<p>A captured record here answers only: what arrived, when, carrying what, and what was served back. It contains no score and no label. The word "bot" appears nowhere in it.</p>

<p>This restraint is the point. The moment a system writes <em>suspicious: true</em> next to an observation, the observation is gone — replaced by somebody's reading of it, with the reasoning discarded. Any later attempt to check that call has nothing left to check against.</p>

<p>Keeping capture clean means conclusions can be recomputed from scratch whenever the method changes, across the entire history rather than only from the fix onward. It costs storage and discipline and buys the ability to be wrong recoverably.</p>

<p>See also <a href="/how-it-works">how it works</a>.</p>
`
  },
  "canary-token": {
    title: "Canary token",
    variant: "glossary_canary_token",
    description:
      "A coined string published at a known instant, used as observed evidence of ingestion rather than relying on a model's self-report.",
    body: `
<h1>Canary token</h1>

<p class="lede">A coined string, published at a recorded instant, used to detect ingestion without asking the model.</p>

<p>Each page here carries a marker such as <code class="mono">asd-veldrun-quathix-9f3ab2</code>. The string is generated from nonsense syllables and random hex so that it exists nowhere else — not in any dictionary, not in any prior text, not in anyone's training data before we minted it.</p>

<p>The instant of publication is recorded. From then on the question "did this page reach a model?" has an observable answer: either the exact string turns up somewhere, or it does not. No interpretation is required and no model is asked to introspect.</p>

<h3>Why not simply ask the model</h3>

<p>Because a model reporting on its own knowledge is the system under test giving evidence about itself. It may state confidently that it knows a site it has never read, or deny one it has. Under the rule this project is built on — no layer may validate itself using its own output as independent evidence — self-report is inadmissible, however plausible it sounds.</p>

<h3>What this is not</h3>

<p>The markers are not hidden. They appear in the visible text of each page and in its structured data, exactly as you see below. Concealing text from human readers while showing it to crawlers is cloaking, and it would invalidate the measurement along with the credibility of anything reported from it.</p>

<p>They are also not traps. The strings identify a page, not a visitor, and carry no information about who fetched it.</p>
`
  }
};

export function glossarySlugs() {
  return Object.keys(GLOSSARY);
}

export function glossaryVariant(slug) {
  return GLOSSARY[slug]?.variant ?? null;
}

export function glossary(slug, canary, published) {
  const entry = GLOSSARY[slug];
  if (!entry) return null;
  return page({
    title: entry.title,
    description: entry.description,
    path: `/glossary/${slug}`,
    canary,
    published,
    body: entry.body
  });
}

const DISALLOWED = {
  "/internal/notes": {
    variant: "disallowed_internal",
    title: "Internal notes",
    description:
      "A page disallowed in robots.txt. It serves ordinary content; fetching it is a measured robots.txt violation.",
    body: `
<h1>Internal notes</h1>

<p class="lede">This page is listed under <code>Disallow</code> in <a href="/robots.txt">robots.txt</a>. It is not hidden, not trapped, and not secret — it simply asks not to be crawled.</p>

<p>It exists so that robots.txt compliance becomes measurable rather than assumed. Every fetch of this URL is recorded like any other request, along with the declared identity of the client that made it. Compliance rates computed from those records appear on the <a href="/lab">lab page</a>.</p>

<p>If you are a human who followed a link here, nothing is wrong and nothing has been logged about you beyond an ordinary request record. If you are an automated client that read robots.txt before arriving, this fetch is now part of the published dataset.</p>

<p>There is no penalty and no blocking. Observation is the whole response.</p>
`
  },
  "/no-crawl/draft": {
    variant: "disallowed_no_crawl",
    title: "Draft",
    description:
      "A second disallowed path, used to distinguish per-path robots.txt handling from blanket behaviour.",
    body: `
<h1>Draft</h1>

<p class="lede">A second path disallowed in <a href="/robots.txt">robots.txt</a>, serving ordinary content.</p>

<p>Two separate disallowed prefixes exist because some clients treat robots.txt rules inconsistently across paths — honouring one directive while ignoring another, or applying only the first matching group. A single test path could not tell those cases apart.</p>

<p>This page has no other purpose and contains no draft of anything. Its content is exactly what you are reading.</p>
`
  },
  "/private-preview/report": {
    variant: "disallowed_private_preview",
    title: "Private preview",
    description:
      "A third disallowed path whose name suggests value, testing whether naming affects crawler behaviour.",
    body: `
<h1>Private preview</h1>

<p class="lede">A third path disallowed in <a href="/robots.txt">robots.txt</a>.</p>

<p>The three disallowed paths are named differently on purpose. <code>/internal/</code>, <code>/no-crawl/</code>, and <code>/private-preview/</code> carry different implications about what a crawler might find, which makes it possible to see whether a path's name changes the rate at which the rule is ignored.</p>

<p>Nothing here is private, and there is no report. The page serves a normal <code>200</code> response to anyone who asks, and the asking is what gets measured.</p>
`
  }
};

export function disallowedPaths() {
  return Object.keys(DISALLOWED);
}

export function disallowedVariant(path) {
  return DISALLOWED[path]?.variant ?? null;
}

export function disallowed(path, canary, published) {
  const entry = DISALLOWED[path];
  if (!entry) return null;
  return page({
    title: entry.title,
    description: entry.description,
    path,
    canary,
    published,
    noindexNote: true,
    body: entry.body
  });
}

export function notFound(path) {
  return page({
    title: "Not found",
    description: "No page exists at this address.",
    path,
    canary: null,
    body: `
<h1>Not found</h1>
<p class="lede">There is no page at this address.</p>
<p>This request was still recorded as an observation, because what gets asked for and never found is data too. Try the <a href="/">home page</a> or the <a href="/lab">lab</a>.</p>
`
  });
}
