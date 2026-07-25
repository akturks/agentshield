import { page, escapeHtml, SITE_ORIGIN } from "../layout.js";
import { headline } from "../stats.js";

// Questions people actually ask about AI crawlers, answered from what this
// observatory can and cannot yet establish. Structured as one page per question
// because that is the shape a retrieval system can quote.
//
// Honesty rule: where the record is too thin to answer, the page says so and
// describes the instrument instead. A fabricated finding would be worth less
// than an empty one, and would contradict the constitution on the same site.

export const QUESTIONS = [
  {
    slug: "do-ai-crawlers-respect-robots-txt",
    question: "Do AI crawlers respect robots.txt?",
    short:
      "Compliance is a claim until it is measured on your own domain. robots.txt is advisory — it has no enforcement mechanism — so the only way to know which clients follow it is to publish a disallowed path that serves ordinary content and record who fetches it anyway. This site does exactly that with three separate disallowed paths.",
    status: "Measuring — the record is too new to report rates.",
    body: `
<p>robots.txt is advisory. It is a text file expressing a preference, with no enforcement behind it. A crawler that ignores it is not breaking anything technical; it is simply not doing what it was asked.</p>

<p>Published compliance claims mostly come from the crawler operators themselves, which is exactly the kind of self-report this observatory refuses. The alternative is to make compliance observable on a domain you control.</p>

<h2>How this site measures it</h2>

<p>Three paths are listed under <code>Disallow</code> in <a href="/robots.txt">robots.txt</a>: <code>/internal/</code>, <code>/no-crawl/</code> and <code>/private-preview/</code>. Each serves an ordinary page returning <code>200</code>. Nothing there is sensitive, hidden or trapped — they are normal pages that simply ask not to be crawled.</p>

<p>They are named differently on purpose. A path called <code>/private-preview/</code> implies something worth having; <code>/no-crawl/</code> does not. If the rate of ignored rules differs between them, the name is doing work.</p>

<p>Three separate prefixes also distinguish blanket behaviour from per-rule behaviour, since some clients honour the first matching group and disregard the rest.</p>

<h2>What a violation does and does not prove</h2>

<p>A fetch of a disallowed path proves the fetch happened. It does not prove the client read robots.txt and chose to disregard it — the client may never have requested the file. Separating those two cases requires seeing a robots.txt fetch from the same client beforehand, which is only reliable when the client is consistent about its address and declared identity.</p>

<p>Both figures are reported separately for that reason: fetches of disallowed paths, and fetches of disallowed paths by clients that had already read the rules.</p>

<h2>Current state</h2>

<p>Live counts are on the <a href="/lab">lab page</a>. No compliance rate is published yet because the sample cannot support one.</p>
`
  },
  {
    slug: "which-ai-crawlers-execute-javascript",
    question: "Which AI crawlers execute JavaScript?",
    short:
      "Most do not, but the assumption is rarely tested. A page whose content is injected by script and which then requests a beacon URL turns this into an observation: any client that reaches the beacon has demonstrably executed JavaScript, and any client that fetches the page without the beacon demonstrably has not.",
    status: "Measuring — the JS probe is live.",
    body: `
<p>This matters more than it sounds. If a crawler does not run scripts, then a site that renders its content client-side is, from that crawler's perspective, close to empty — regardless of how much text a human sees.</p>

<p>It also explains why most analytics is blind here. Browser-based tracking only reports when scripts run, so a JavaScript tracker will faithfully report that no crawlers ever visit. That is not a measurement of crawler traffic; it is a measurement of script execution.</p>

<h2>How this site measures it</h2>

<p><a href="/probe/js">One page</a> carries its content inside a script rather than in the served HTML. The same script then requests a beacon URL carrying the identifier of that specific page view.</p>

<p>Reaching the beacon requires having executed the script. So the beacon request is direct evidence of JavaScript execution by that client, on that visit — not an inference from a user agent string or a capability table.</p>

<p>Clients that fetch the page and never the beacon produce the opposite evidence, equally recorded.</p>

<h2>Why this page is the only one with scripts</h2>

<p>Every other page here ships no JavaScript at all. Script execution is the variable under measurement, so it cannot also be a dependency of the measurement — a site that required scripts to be observed could only ever observe clients that run them.</p>

<h2>Current state</h2>

<p>The probe is live and recording. Results appear on the <a href="/lab">lab page</a> as distinct user agents observed executing scripts. No general claim about any named crawler is made yet.</p>
`
  },
  {
    slug: "how-long-until-published-text-reaches-a-model",
    question:
      "How long does it take for newly published text to appear in an AI model?",
    short:
      "There is no reliable public figure for this, largely because measuring it requires knowing that a specific page was ingested rather than guessing. Publishing a coined string that exists nowhere else, recording the instant it was published, and watching for that exact string to appear turns the interval into an observation.",
    status: "Measuring — no appearance observed yet.",
    body: `
<p>Site owners are routinely advised to publish for AI systems without any established figure for how long ingestion takes, or whether it happened. The gap exists because the measurement is awkward: you have to establish that one specific page reached a model, and confirming that is precisely the hard part.</p>

<h2>Why the obvious method fails</h2>

<p>The obvious method is to ask. Prompt a model about your page and see whether it knows. This does not work: a model can describe a page it never read and deny one it did, and either way it is the system under test giving evidence about itself. Under this observatory's <a href="/constitution">constitution</a> that is inadmissible, however plausible the answer sounds.</p>

<h2>How this site measures it</h2>

<p>Every page here carries a coined marker — nonsense syllables plus random hex, such as the one at the foot of this page. The string is generated so that it exists nowhere else: not in any dictionary, not in any prior text, not in anything trained on before it was minted. Its publication instant is recorded.</p>

<p>From then on the question has an observable answer. Either that exact string turns up, or it does not. Its appearance is evidence of ingestion; the interval since publication is the number.</p>

<h2>What the result will and will not support</h2>

<p>An appearance is strong evidence. A non-appearance is weak evidence — the page may not have been ingested, or may have been ingested and never surfaced. The measurement is also of one small new domain about a niche subject, so it will describe this site rather than the web.</p>

<h2>Current state</h2>

<p>${headline().markers} markers are published, each with the instant it was minted. Their dates are listed on the <a href="/lab">lab page</a> with an empty column for first observation. That column is the entire point, and it is currently empty.</p>
`
  },
  {
    slug: "how-to-tell-if-an-ai-read-your-site",
    question: "How can you tell whether an AI system has read your site?",
    short:
      "Two independent sources of evidence: your own server logs, which show which crawlers fetched what and when, and a canary string published at a known instant whose later appearance proves ingestion. Server logs prove fetching; canaries prove ingestion. Asking a model proves nothing.",
    status: "Method published; both instruments running.",
    body: `
<p>These are two different questions and they need different instruments.</p>

<h2>Did a crawler fetch the page</h2>

<p>Your server already knows. Every request carries a declared user agent, an address, a timestamp and a path. Capture has to happen server-side: crawlers generally do not execute JavaScript, so browser analytics cannot see them at all.</p>

<p>The declared identity is a claim rather than a fact — anyone can send any user agent string — so counts by crawler name are counts of claims. Some operators publish address ranges that allow verification; where they do, that check is worth doing.</p>

<h2>Did the content reach a model</h2>

<p>Fetching is not ingestion. A page can be fetched and discarded, or fetched for a live answer and never retained.</p>

<p>The usable instrument is a coined string: publish something that exists nowhere else, record when you published it, and watch for that exact string to appear in a model's output. Appearance is observed evidence. See <a href="/questions/how-long-until-published-text-reaches-a-model">how long ingestion takes</a> and the <a href="/glossary/canary-token">canary token</a> definition.</p>

<h2>What does not work</h2>

<p>Asking the model. It is the system under test reporting on itself, and it will produce a confident answer either way. This is the method most AI visibility tools are built on, which is <a href="/questions/why-not-just-ask-the-model">worth understanding in its own right</a>.</p>
`
  },
  {
    slug: "why-not-just-ask-the-model",
    question:
      "Why not just ask the model what it knows about your site?",
    short:
      "Because a model describing its own knowledge is the system under test giving evidence about itself. It can assert familiarity with pages it never read and deny ones it did, and nothing in the answer distinguishes the two. No layer may validate itself using its own output as independent evidence.",
    status: "Founding principle of this observatory.",
    body: `
<p>It is the natural thing to try, and it is the method underneath most tools that claim to measure AI visibility: prompt an assistant about a brand, record the reply, chart the replies over time.</p>

<h2>The structural problem</h2>

<p>The model is the thing being measured. Asking it to report on its own knowledge makes it both instrument and subject, and there is nothing in the output that separates recall from plausible construction. A model can produce a fluent description of a site it has never encountered, because producing fluent descriptions is what it does.</p>

<p>Repeating the prompt does not help. Consistency across attempts measures the stability of the generation, not the truth of it.</p>

<h2>The rule</h2>

<blockquote>No layer may validate itself using its own output as independent evidence.</blockquote>

<p>Stated generally it sounds like philosophy. Applied, it removes a whole category of product. It also removes several tempting shortcuts from this site: no classification may be stored as though it were an observation, and no figure may be published that cannot be recomputed from the raw record.</p>

<h2>What replaces it</h2>

<p>Evidence from outside the model. Server-side records of what was actually fetched, and coined strings published at known instants whose appearance is observable independently of anything a model says about itself. Slower, narrower, checkable.</p>

<p>The trade is deliberate. A measurement you can verify and a measurement that sounds impressive are usually not the same measurement.</p>
`
  },
  {
    slug: "should-you-block-ai-crawlers",
    question: "Should you block AI crawlers?",
    short:
      "It depends on whether you want your content to be retrievable in AI answers, and the two cases are increasingly distinguishable. Blocking corpus crawlers keeps content out of training; blocking retrieval crawlers keeps you out of live answers, which is closer to being delisted from search. This observatory allows everything, because being read is the subject of the study.",
    status: "Context, not a recommendation.",
    body: `
<p>This site is not the right source for a recommendation — it allows every crawler because observing them is the entire purpose. But the decision is frequently framed badly, and the framing is worth separating from the choice.</p>

<h2>Different crawlers, different consequences</h2>

<p>Blocking a <strong>corpus crawler</strong> reduces the chance of your text entering a training set. The effect is delayed and effectively permanent in either direction: content already collected is not withdrawn by blocking later.</p>

<p>Blocking a <strong>retrieval crawler</strong> keeps you out of answers being generated right now. That is much closer to removing yourself from a search index, and the cost is immediate.</p>

<p>Blocking a <strong>user-triggered fetcher</strong> means that when a person explicitly asks an assistant to read your page, it cannot. This is the closest thing to refusing a referred visitor.</p>

<p>Many operators publish separate agents for these roles, which makes a mixed policy possible: decline the corpus collection, permit the retrieval. Whether the separation is honoured is itself an <a href="/questions/do-ai-crawlers-respect-robots-txt">empirical question</a>.</p>

<h2>What blocking does not do</h2>

<p>robots.txt has no enforcement. It expresses a preference to clients that choose to read it. A client that ignores it is unaffected, and content already indexed elsewhere remains reachable regardless.</p>

<h2>A practical note</h2>

<p>Some infrastructure providers now block AI crawlers by default on new domains. If you have not deliberately allowed them, you may already be blocking them without having chosen to — worth verifying by requesting your own site with a crawler user agent and observing the response code.</p>
`
  },
  {
    slug: "which-content-format-do-ai-crawlers-prefer",
    question: "Which content format do AI crawlers fetch most?",
    short:
      "Widely asserted, rarely measured. Publishing identical content as HTML, JSON, Markdown, plain text and RSS — each carrying a distinct marker — turns format preference from folklore into a count of which variants were actually fetched, and by whom.",
    status: "Measuring — five format variants live.",
    body: `
<p>Advice about structuring content for AI systems circulates well ahead of the evidence for it. Recommendations to prefer one markup style, add a particular file, or restructure pages are usually offered without a measurement behind them.</p>

<h2>How this site measures it</h2>

<p>The same statement is published five ways, each carrying its own coined marker:</p>

<ul>
<li><a href="/probe/html">HTML</a> — ordinary server-rendered markup</li>
<li><a href="/probe/data.json">JSON</a> — structured, machine-first</li>
<li><a href="/probe/data.md">Markdown</a> — the format most model training pipelines normalise toward</li>
<li><a href="/probe/data.txt">Plain text</a> — no markup at all</li>
<li><a href="/feed.xml">RSS</a> — the syndication path</li>
</ul>

<p>All five are linked from the home page and listed in the <a href="/sitemap.xml">sitemap</a>, so no variant is easier to discover than another. Which get fetched, by which clients, and how often is then a matter of record.</p>

<p>An <a href="/llms.txt">llms.txt</a> file is also served. Whether anything fetches it is a finding in itself, given how often it is recommended.</p>

<h2>What this can establish</h2>

<p>Fetch counts per variant, per declared client. It cannot establish which format was <em>preferred</em> in any deeper sense — a crawler may fetch a format and discard it — nor can one small domain settle the question for the web. Distinct markers per variant do, however, make it possible to tell later which version a model saw.</p>

<h2>Current state</h2>

<p>Counts appear on the <a href="/lab">lab page</a> under format preference. The sample is currently too small to interpret.</p>
`
  },
  {
    slug: "what-are-gptbot-claudebot-perplexitybot",
    question: "What are GPTBot, ClaudeBot, PerplexityBot and CCBot?",
    short:
      "Declared identities used by automated clients associated with AI systems, spanning corpus collection, retrieval indexing and user-triggered fetching. The names appear in the User-Agent header, which is unverified — the string is a claim about identity, not proof of it.",
    status: "Reference; observed arrivals listed on the lab page.",
    body: `
<p>These names appear in the <code>User-Agent</code> header of requests to public websites. Grouping them by what they are for is more useful than listing them, because the purposes carry different consequences for a site owner.</p>

<h2>By role</h2>

<p><strong>Corpus collection.</strong> Agents gathering pages in bulk for training or for a general-purpose archive. They arrive unprompted and sweep broadly. CCBot, operated by the non-profit Common Crawl, belongs here and long predates the current generation of AI systems; its archives are widely reused.</p>

<p><strong>Retrieval indexing.</strong> Agents maintaining an index that an AI product queries while answering a question. Behaviourally close to a traditional search crawler.</p>

<p><strong>User-triggered fetching.</strong> Agents fetching one page because a person just asked an assistant something requiring it. Operators increasingly separate this role into its own declared name, which is what makes a mixed <a href="/questions/should-you-block-ai-crawlers">allow-some, decline-others policy</a> expressible at all.</p>

<h2>The important caveat</h2>

<p>A user agent string is unverified. Any client can send any string, including one belonging to a well-known crawler. Counts by name are counts of claims.</p>

<p>Some operators publish IP ranges or reverse-DNS conventions that allow a declared identity to be checked, and where that exists it is worth using. Absent verification, this observatory stores the declaration verbatim, treats it as a claim, and reasons about <a href="/observatory">observed behaviour</a> separately.</p>

<h2>Naming changes</h2>

<p>Agent names, roles and the split between them change as operators revise their crawling. Any list is a snapshot. The reason this site records complete request headers rather than only a parsed agent name is so that the record stays interpretable when the names move.</p>

<h2>Observed here</h2>

<p>Declared clients actually seen by this site, with first and last appearance, are listed on the <a href="/lab">lab page</a>.</p>
`
  }
];

const bySlug = new Map(QUESTIONS.map((q) => [q.slug, q]));

export function questionSlugs() {
  return QUESTIONS.map((q) => q.slug);
}

export function questionVariant(slug) {
  return bySlug.has(slug) ? `question_${slug.replace(/-/g, "_")}` : null;
}

export function questionsIndex(canary, published) {
  const faq = {
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map((q) => ({
      "@type": "Question",
      name: q.question,
      url: `${SITE_ORIGIN}/questions/${q.slug}`,
      acceptedAnswer: { "@type": "Answer", text: q.short }
    }))
  };

  return page({
    title: "Questions",
    description:
      "Direct answers about AI crawler behaviour: robots.txt compliance, JavaScript execution, ingestion latency, format preference, and why asking a model about itself proves nothing.",
    path: "/questions",
    canary,
    published,
    mainEntity: faq.mainEntity,
    schemaType: "FAQPage",
    body: `
<h1>Questions</h1>

<p class="lede">Questions about how AI systems read the web, answered from what can be observed — and marked plainly where the record is not yet good enough to answer.</p>

<p>Several of these have no reliable public answer, which is the reason this observatory exists. Where a question is still being measured, the page says so and describes the instrument rather than inventing a figure.</p>

${QUESTIONS.map(
      (q) => `<div class="qa">
<h3><a href="/questions/${q.slug}">${escapeHtml(q.question)}</a></h3>
<p>${escapeHtml(q.short)}</p>
<p class="status">${escapeHtml(q.status)}</p>
</div>`
    ).join("\n")}

<h2>Method</h2>

<p>Answers here are constrained by the <a href="/constitution">constitution</a>: no figure is published that cannot be recomputed from the stored record, and no model's account of its own behaviour is treated as evidence. Live counts are on the <a href="/lab">lab page</a>, and the ways they could mislead are listed in the <a href="/lab/methodology">methodology</a>.</p>
`
  });
}

export function questionPage(slug, canary, published) {
  const q = bySlug.get(slug);
  if (!q) return null;

  // Bodies are authored as strings; the few figures inside them are substituted
  // from the record here, so a hand-written sentence can never drift out of
  // agreement with the counters on /lab.
  const body = q.body.replace(/\$\{headline\(\)\.markers\}/g, String(headline().markers));

  const others = QUESTIONS.filter((o) => o.slug !== slug).slice(0, 4);

  return page({
    title: q.question,
    description: q.short.slice(0, 300),
    path: `/questions/${slug}`,
    canary,
    published,
    schemaType: "QAPage",
    mainEntity: {
      "@type": "Question",
      name: q.question,
      text: q.question,
      answerCount: 1,
      acceptedAnswer: { "@type": "Answer", text: q.short }
    },
    body: `
<h1>${escapeHtml(q.question)}</h1>

<p class="lede">${escapeHtml(q.short)}</p>

<p class="status">${escapeHtml(q.status)}</p>

${body}

<h2>Related</h2>
<ul>
${others.map((o) => `<li><a href="/questions/${o.slug}">${escapeHtml(o.question)}</a></li>`).join("\n")}
</ul>

<p><a href="/questions">All questions</a></p>
`
  });
}
