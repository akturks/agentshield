// The constitution as data rather than prose, so the page that states a rule
// and the finding that claims to obey it read from the same source. A rule
// referenced by a finding but absent from the page — or the reverse — would be
// exactly the drift this project exists to prevent.

export const ARTICLES = [
  {
    id: "I",
    slug: "reality-is-not-interpretation",
    title: "Reality is not interpretation",
    short: "Reality ≠ Interpretation",
    body: `<p>What was observed and what it means are different objects and are stored separately. A record of a request contains no score, no verdict and no label. The moment a judgement is written into the record, the evidence needed to check that judgement is gone.</p>`
  },
  {
    id: "II",
    slug: "interpretation-is-versioned",
    title: "Interpretation is versioned",
    short: "Every conclusion carries its method's version",
    body: `<p>Every conclusion carries the version of the method that produced it. Improving the method means deleting the old conclusions and recomputing them over the same untouched observations — not starting a fresh dataset and quietly abandoning the old one.</p>`
  },
  {
    id: "III",
    slug: "no-layer-validates-itself",
    title: "No layer validates itself",
    short: "No layer validates itself with its own output",
    body: `<p>No layer may validate itself using its own output as independent evidence. Assessment cannot confirm assessment. A model's account of its own knowledge is not evidence about that model. This rule costs more than any other and is the reason the rest exists.</p>`
  },
  {
    id: "IV",
    slug: "replay-guesses-nothing",
    title: "Replay guesses nothing",
    short: "Every figure must be reproducible from the record",
    body: `<p>Any published figure must be reproducible from the stored record alone. Where the record is silent, the answer is that it is unknown — not an estimate presented as a measurement.</p>`
  },
  {
    id: "V",
    slug: "observation-does-not-alter-the-observed",
    title: "Observation does not alter the observed",
    short: "Identical bytes to every client",
    body: `<p>Every client receives identical bytes for the same URL. No content is varied by user agent, nothing is hidden from human readers to be shown to crawlers, and no page attempts to instruct an agent that reads it. A measurement that changes its subject is not a measurement.</p>`
  },
  {
    id: "VI",
    slug: "honest-about-sample-size",
    title: "The record is honest about its size",
    short: "Sample size is stated; absence is reported as absence",
    body: `<p>Figures are published from the first observation onward, including when they are too sparse to support a conclusion. Sample size is stated. Absence of evidence is reported as absence of evidence.</p>`
  },
  {
    id: "VII",
    slug: "observation-is-not-surveillance",
    title: "Observation is not surveillance",
    short: "The unit of observation is a request, not a person",
    body: `<p>The unit of observation is a request, not a person. No cookies, no fingerprinting scripts, no cross-site tracking, no accounts. Published tables report user agents, paths and counts; nothing that identifies an individual is collected or shown.</p>`
  },
  {
    id: "VIII",
    slug: "documentation-is-a-deliverable",
    title: "Documentation is a deliverable",
    short: "An unrecorded change is half-made",
    body: `<p>Code changes the system. Documentation changes the understanding of the system. A change that alters how this observatory works and is not written down has only been half made.</p>`
  }
];

// The layers, as data rather than as a sixth prose document. Five markdown
// files already describe this system's architecture and they contradict each
// other; the fix for that is not a sixth file but a single definition the code
// and the page both read from — and, below, that the running system checks
// itself against.
export const LAYERS = [
  {
    id: "reality",
    name: "Reality",
    oneLine: "What happened to us.",
    body: `<p>Observed fact, recorded as it arrived. A request, its headers, its timing, what was served back. Written once and never edited.</p>
<p>Reality contains no score, no verdict and no label. Not because labels are useless, but because a label written into the record destroys the evidence needed to check it later.</p>`,
    rule: "Reality is only ever appended to. Nothing computes it; it is received."
  },
  {
    id: "interpretation",
    name: "Interpretation",
    oneLine: "What we concluded from it.",
    body: `<p>Signals, findings, classifications — everything derived. Each carries the version of the method that produced it.</p>
<p>Interpretation is disposable by design. Deleting all of it and recomputing from reality must reproduce it exactly; if it cannot, something was guessed.</p>`,
    rule: "Interpretation may read reality. It may never write to it."
  },
  {
    id: "action",
    name: "Action",
    oneLine: "What we did to the world.",
    body: `<p>Announcing a URL to an index. Asking an assistant to read a page. These are things this system caused, not things it observed.</p>
<p>An action is never the end of a chain — it is an attempt to produce new reality. We announce, and then we wait, and whether anyone arrives is observed back in the reality layer like any other visit. The action itself proves nothing about the world.</p>`,
    rule:
      "An action may never be cited as evidence. It sets a clock to zero; the result is observed separately."
  }
];

export const LAYER_CYCLE = `Reality → Interpretation → Action → Reality`;

const byId = new Map(ARTICLES.map((a) => [a.id, a]));

export function article(id) {
  return byId.get(id) ?? null;
}

// Which rules govern the output of each detector. A finding carries these so a
// reader can see the standard it was held to rather than taking it on trust.
export const DETECTOR_ARTICLES = {
  ai_agent_arrival: ["I", "IV", "VI"],
  robots_violation: ["I", "IV", "VI"],
  automated_enumeration: ["I", "IV", "VI"],
  distributed_crawl: ["I", "III", "VI", "VII"],
  arrival_host: ["I", "IV", "VI"],
  identity_inconsistency: ["I", "III", "VI"],
  js_execution: ["I", "III", "VI"],
  format_preference: ["I", "IV", "VI"],
  human_analysis: ["I", "IV", "VI"]
};

export function articlesFor(detectorId) {
  return (DETECTOR_ARTICLES[detectorId] ?? ["I", "IV"]).map(article).filter(Boolean);
}
