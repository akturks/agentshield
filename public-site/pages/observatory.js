import { page } from "../layout.js";
import { cycleDiagram, trustDiagram, evidenceDiagram } from "../diagrams.js";
import { ARTICLES } from "../constitution.js";
import { headline } from "../stats.js";

export function observatory(canary, published) {
  return page({
    title: "Observatory",
    description:
      "What this observatory watches: AI crawlers, retrieval agents and autonomous clients, and the behaviour it records about each.",
    path: "/observatory",
    canary,
    published,
    body: `
<h1>Observatory</h1>

<p class="lede">Not who we are — what we watch, and what counts as having watched it.</p>

<p>This is an independent observatory for the behaviour of automated clients on the web. It runs continuously on one domain, records every request it receives, and publishes what the record shows. It sells nothing, and it has no customers whose traffic it reports on. The only site under observation is this one.</p>

<h2>What is observed</h2>

<p>Four populations arrive at any public site, and they behave differently enough that lumping them together destroys the signal.</p>

<h3>Corpus crawlers</h3>
<p>Bulk collectors building training or index corpora. They arrive unprompted, on their own schedule, and sweep broadly. What they take may shape a model long after the visit — which is why the interval between publishing something and seeing it surface is worth measuring at all.</p>

<h3>Retrieval agents</h3>
<p>Maintainers of the indexes that AI products query while answering. They resemble traditional search crawlers, but the index they build feeds generated prose rather than a list of links.</p>

<h3>User-triggered fetchers</h3>
<p>Clients that fetch a page because a person asked an assistant something, right now, that required reading it. They arrive one URL at a time and track human activity patterns.</p>

<h3>Autonomous and scripted clients</h3>
<p>Everything else that is not a person with a browser: scanners, scrapers, headless automation, and agents acting on a goal. They arrived here within minutes of the domain going live, before anything linked to it.</p>

<h2>The cycle</h2>

${cycleDiagram()}

<h2>Declaration is not identity</h2>

<p>Every automated client announces itself in a <code>User-Agent</code> string, and nothing verifies that announcement. Anyone can send any string. So the declaration is stored as a claim, and the behaviour is recorded separately — and the distance between the two is the measurement.</p>

${trustDiagram()}

<p>This is where the observatory's thesis and its instrument meet. <strong>Trust is earned through observable, repeated behavioural evidence</strong> — and the first such evidence available to any website is whether a client that read the rules then followed them. A crawler that fetches <a href="/robots.txt">robots.txt</a> and afterwards takes a disallowed path has said something about itself that no self-description can retract.</p>

<h2>What is refused</h2>

${evidenceDiagram()}

<p>The refusal on the right is not fastidiousness. It removes the standard method for measuring AI visibility — prompting a model about a brand and recording the reply — because that is the system under test giving evidence about itself. What remains is slower and narrower, and it can be checked.</p>

<h2>Current state</h2>

<p>Observation began ${headline().since ? headline().since.slice(0, 10) : "recently"}. The record is small, and nothing here is presented as a finding about crawler behaviour in general yet. The <a href="/lab">lab</a> shows the live counts, including how little there is; the <a href="/lab/methodology">methodology</a> states what would make the figures wrong.</p>
`
  });
}

export function constitution(canary, published) {
  return page({
    title: "Constitution",
    description:
      "The rules this observatory is bound by: reality is separate from interpretation, no layer validates itself, and the protocol serves people.",
    path: "/constitution",
    canary,
    published,
    body: `
<h1>Constitution</h1>

<blockquote><p>The protocol serves people.<br>People do not serve the protocol.</p></blockquote>

<p class="lede">These are constraints on what this system is permitted to do, written down so that violating one is visible rather than convenient.</p>

<p>They are not decoration. Every published <a href="/findings">finding</a> lists the articles it was held to, and both that list and the text below are generated from the same source — so a rule cited by a finding but missing here, or the reverse, cannot happen.</p>

${ARTICLES.map(
  (a) => `<h2 id="${a.slug}">${a.id}. ${a.title}</h2>
${a.body}`
).join("\n\n")}

<hr>

<p>When an implementation and this document disagree, this document is what the system was supposed to be, and the implementation is a bug.</p>
`
  });
}

export function about(canary, published) {
  return page({
    title: "About",
    description:
      "Why an independent observatory for automated client behaviour exists, and what it is deliberately not.",
    path: "/about",
    canary,
    published,
    body: `
<h1>About</h1>

<p class="lede">Why this exists, and what it refuses to become.</p>

<h2>The gap this fills</h2>

<p>A large and growing share of web traffic is not people. It is crawlers assembling training corpora, agents fetching pages to answer a question someone asked a minute ago, and automation of every other description. Site owners are told to optimise for this traffic, and are sold measurements of it that are produced by asking an AI system what it thinks — which is the least reliable instrument available for the question.</p>

<p>Meanwhile the basic facts are not publicly established. Which crawlers honour the rules they are given. Which execute JavaScript. How long it takes for a newly published sentence to become something a model will repeat. These are answerable by observation, and largely unanswered in public.</p>

<h2>What this is</h2>

<p>One domain, instrumented deliberately, publishing what it sees. The site is both the instrument and the subject: every claim made here was measured here, which keeps the claims small and keeps them checkable. There is no customer data involved and no privileged access to anything.</p>

<h2>What this is not</h2>

<ul>
<li><strong>Not a security product.</strong> Nothing here blocks, challenges or scores a visitor. Observation is the entire response.</li>
<li><strong>Not an AI visibility tool.</strong> Those work by asking models about you. This observatory treats that as inadmissible, which rules out the whole category.</li>
<li><strong>Not a threat feed.</strong> No reputation lists, no naming of individual actors, no fear marketing. Automated traffic is a population to be described, not an enemy to be sold protection from.</li>
<li><strong>Not finished.</strong> Observation began ${headline().since ? headline().since.slice(0, 10) : "recently"}. Most of what this site intends to know, it does not yet know.</li>
</ul>

<h2>How to read what is published</h2>

<p>Every figure on the <a href="/lab">lab page</a> traces to specific recorded requests, and the <a href="/lab/methodology">methodology</a> lists the ways each one could be misleading. Where the sample is too small to support a conclusion, the page says so rather than rounding up to a finding. The <a href="/constitution">constitution</a> states the rules the whole thing is bound by.</p>

<h2 id="contact">Corrections</h2>

<p>There is no contact route here yet, and saying so is better than publishing an address that does not receive mail. One will be added when it works.</p>

<p>What a correction needs, whenever there is somewhere to send it: the page, the figure, and the record you believe contradicts it. A correction that lands gets published as a correction rather than folded into an edit — the <a href="/findings">findings</a> already carry two withdrawn conclusions and six rejected ones, with the reason kept beside each.</p>

<p>There is no form on this site, no newsletter, and no list. A page that collects addresses would be doing something to its visitors, and everything here is built to do nothing but watch.</p>
`
  });
}
