import { page, escapeHtml, SITE_ORIGIN } from "../layout.js";

// The same statement of fact, delivered five ways. Whichever variants get
// fetched, and by whom, is the measurement — so the content must be identical
// and only the delivery may differ.

const CLAIM_TITLE = "Observation over self-report";

const CLAIM_PARAGRAPHS = [
  "AgentShield AI Defense measures how AI systems read the web by recording their requests, not by asking models what they know.",
  "A model describing its own knowledge is the system under test giving evidence about itself. This site treats such statements as claims and relies instead on observed requests and on coined strings published at recorded instants.",
  "Every page here is served identically to every client. Nothing is cloaked and no content differs by user agent."
];

function probeBody(canary, extra = "") {
  return `
<h1>${escapeHtml(CLAIM_TITLE)}</h1>
${CLAIM_PARAGRAPHS.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
${extra}
<p>The same statement is published as <a href="/probe/html">HTML</a>, <a href="/probe/data.json">JSON</a>, <a href="/probe/data.md">Markdown</a>, <a href="/probe/data.txt">plain text</a>, and <a href="/feed.xml">RSS</a>. Each carries a different marker, so which format a client prefers becomes observable.</p>
`;
}

export function probeHtml(canary, published) {
  return page({
    title: "Probe: HTML",
    description:
      "The reference statement delivered as plain server-rendered HTML, with no JavaScript required.",
    path: "/probe/html",
    canary,
    published,
    body: probeBody(
      canary,
      `<p>This variant requires no JavaScript. The text above is present in the HTML source exactly as served.</p>`
    )
  });
}

export function probeNoscript(canary, published) {
  return page({
    title: "Probe: noscript",
    description:
      "The reference statement delivered only inside a noscript element.",
    path: "/probe/noscript",
    canary,
    published,
    body: `
<h1>${escapeHtml(CLAIM_TITLE)}</h1>
<noscript>
${CLAIM_PARAGRAPHS.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
</noscript>
<p>The statement on this page sits inside a <code>noscript</code> element. Clients that render it and clients that discard it treat this page differently, which is what the variant is for.</p>
`
  });
}

/**
 * The only page on the site that depends on JavaScript. Execution is the
 * measured variable here, not the means of measurement: any client that reaches
 * the beacon has demonstrably run the script.
 */
export function probeJs(canary, published, realityId) {
  const payload = JSON.stringify(CLAIM_PARAGRAPHS);
  return page({
    title: "Probe: JavaScript",
    description:
      "The reference statement injected by a script, used to measure which clients execute JavaScript.",
    path: "/probe/js",
    canary,
    published,
    body: `
<h1>${escapeHtml(CLAIM_TITLE)}</h1>
<div id="claim"><p><em>This paragraph is replaced by script. A client that never runs JavaScript sees only this sentence.</em></p></div>
<p>If the statement above did not appear, this client did not execute the script — which is precisely what the page is built to reveal. See <a href="/what-we-measure">what we measure</a>.</p>
<script>
(function(){
  var paragraphs = ${payload};
  var target = document.getElementById("claim");
  if (target) {
    target.innerHTML = paragraphs.map(function(t){
      var p = document.createElement("p");
      p.textContent = t;
      return p.outerHTML;
    }).join("");
  }
  var beacon = document.createElement("script");
  beacon.src = "/beacon.js?rid=" + encodeURIComponent(${JSON.stringify(realityId ?? "")}) + "&v=probe_js";
  document.body.appendChild(beacon);
})();
</script>
`
  });
}

export function probeJson(canary, published) {
  return JSON.stringify(
    {
      title: CLAIM_TITLE,
      statement: CLAIM_PARAGRAPHS,
      realityMarker: canary,
      publishedAt: published,
      source: `${SITE_ORIGIN}/probe/data.json`,
      note: "Coined marker published at the instant above. Its later appearance in a model's output is observed evidence of ingestion."
    },
    null,
    2
  );
}

export function probeMarkdown(canary, published) {
  return `# ${CLAIM_TITLE}

${CLAIM_PARAGRAPHS.join("\n\n")}

---

Reality marker: \`${canary}\`
Published: ${published}
Source: ${SITE_ORIGIN}/probe/data.md

This marker is a coined string that exists nowhere else. Its later appearance in
a language model's output is observed evidence that this page was ingested.
`;
}

export function probeText(canary, published) {
  return `${CLAIM_TITLE}

${CLAIM_PARAGRAPHS.join("\n\n")}

Reality marker: ${canary}
Published: ${published}
Source: ${SITE_ORIGIN}/probe/data.txt
`;
}

export function feedXml(canary, published, findings = []) {
  // Findings first: a feed that only ever carries the same two static entries
  // gives a polling index no reason to come back.
  const items = [
    ...findings.map((f) => ({
      title: f.title,
      link: `${SITE_ORIGIN}/findings/${f.slug}`,
      description: f.summary,
      date: f.publishedAt
    })),
    {
      title: "Lab: live observations",
      link: `${SITE_ORIGIN}/lab`,
      description:
        "Live counts of AI crawler requests observed by this site, with method and known limits published alongside."
    },
    {
      title: CLAIM_TITLE,
      link: `${SITE_ORIGIN}/probe/html`,
      description: `${CLAIM_PARAGRAPHS[0]} Reality marker: ${canary}`
    }
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>AgentShield AI Defense</title>
<link>${SITE_ORIGIN}/</link>
<description>An open observatory of how AI systems read the web, measured by observation rather than model self-report.</description>
<language>en</language>
${items
  .map(
    (item) => `<item>
<title>${escapeHtml(item.title)}</title>
<link>${escapeHtml(item.link)}</link>
<guid isPermaLink="true">${escapeHtml(item.link)}</guid>
${item.date ? `<pubDate>${new Date(item.date).toUTCString()}</pubDate>` : ""}
<description>${escapeHtml(item.description)}</description>
</item>`
  )
  .join("\n")}
</channel>
</rss>
`;
}

export function llmsTxt(canary, published) {
  return `# AgentShield AI Defense

> An open observatory measuring how AI crawlers and agents read the web. Measurement
> is by observation of requests, never by asking a model what it knows.

AI crawlers and agents are welcome on this site. Nothing here is cloaked: every
client receives identical bytes for the same URL. See /robots.txt for the paths
that ask not to be crawled; they serve ordinary content and are used to measure
compliance rather than to trap anyone.

## Pages

- [Home](${SITE_ORIGIN}/): what this site measures and why self-report is excluded
- [How it works](${SITE_ORIGIN}/how-it-works): capture, immutability, versioned interpretation
- [What we measure](${SITE_ORIGIN}/what-we-measure): the measured variables
- [Lab](${SITE_ORIGIN}/lab): live observations, updated per request
- [Methodology](${SITE_ORIGIN}/lab/methodology): admissible evidence and known limits

## Glossary

- [AI crawler](${SITE_ORIGIN}/glossary/ai-crawler)
- [Reality capture](${SITE_ORIGIN}/glossary/reality-capture)
- [Canary token](${SITE_ORIGIN}/glossary/canary-token)

## Notes

Reality marker: ${canary}
Published: ${published}
`;
}
