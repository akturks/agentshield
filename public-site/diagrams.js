// Architecture diagrams as inline SVG.
//
// SVG rather than a diagramming library because content pages ship no
// JavaScript: a crawler that does not execute scripts must still receive the
// diagram and its labels. Colours come from currentColor so both themes work
// without a media query, and every figure carries a prose description that
// says the same thing for anything reading text only.

function figure({ title, desc, svg, caption }) {
  return `<figure class="diagram">
<div class="scroll">${svg}</div>
<figcaption>${caption}</figcaption>
</figure>`;
}

const DEFS = `<defs>
<marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
<path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
</marker>
</defs>`;

function box(x, y, w, h, label, sub, opts = {}) {
  const dash = opts.dashed ? ' stroke-dasharray="4 3"' : "";
  const fill = opts.solid ? 'fill="currentColor" fill-opacity="0.07"' : 'fill="none"';
  const labelY = sub ? y + h / 2 - 3 : y + h / 2 + 5;
  return `<g>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" ${fill} stroke="currentColor" stroke-opacity="0.5"${dash}/>
<text x="${x + w / 2}" y="${labelY}" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${label}</text>
${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="10.5" fill="currentColor" fill-opacity="0.62">${sub}</text>` : ""}
</g>`;
}

function arrow(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.4" marker-end="url(#ah)"/>`;
}

function note(x, y, text, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="10.5" fill="currentColor" fill-opacity="0.6" font-style="italic">${text}</text>`;
}

/** Request in, immutable record, versioned reading on top. */
export function pipelineDiagram() {
  const svg = `<svg viewBox="0 0 760 320" width="760" height="320" class="dg" role="img" aria-labelledby="dg1t dg1d" xmlns="http://www.w3.org/2000/svg">
<title id="dg1t">Capture pipeline</title>
<desc id="dg1d">An incoming request is recorded by the capture hook into an immutable reality table. A versioned interpreter reads that table and writes signals to a separate table, which the lab page renders. Replacing the interpreter deletes and recomputes only the interpretation.</desc>
${DEFS}
${box(20, 40, 140, 54, "HTTP request", "any client, any agent")}
${arrow(163, 67, 205, 67)}
${box(208, 40, 140, 54, "Capture hook", "onRequest / onResponse")}
${arrow(351, 67, 393, 67)}
${box(396, 30, 190, 74, "RequestReality", "method · headers · IP · timing", { solid: true })}
${note(491, 120, "INSERT-only — never updated")}
${note(491, 135, "no score, no verdict, no label")}

<line x1="491" y1="145" x2="491" y2="182" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.4" marker-end="url(#ah)"/>

${box(396, 186, 190, 54, "Interpreter v1", "reads reality only")}
${arrow(389, 213, 349, 213)}
${box(196, 186, 150, 54, "Interpretation", "tagged with version")}
${arrow(189, 213, 149, 213)}
${box(20, 186, 126, 54, "/lab", "published figures")}

<path d="M596 213 L640 213 L640 275 L491 275 L491 250" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ah)"/>
${note(640, 297, "v2 → delete v1 rows, recompute over the same untouched reality", "end")}
</svg>`;

  return figure({
    svg,
    caption:
      "A request is recorded once and never edited. Every published figure is derived from that record by an interpreter carrying a version number, so improving the method means recomputing history rather than starting a new dataset."
  });
}

/** What counts as evidence, and what is refused. */
export function evidenceDiagram() {
  const svg = `<svg viewBox="0 0 760 250" width="760" height="250" class="dg" role="img" aria-labelledby="dg2t dg2d" xmlns="http://www.w3.org/2000/svg">
<title id="dg2t">Admissible and inadmissible evidence</title>
<desc id="dg2d">Observed requests, request headers, timing and the appearance of a published canary string are admissible evidence. A model's own account of what it knows, and an inference stored as though it were an observation, are refused.</desc>
${DEFS}
<text x="20" y="26" font-size="12" font-weight="700" fill="currentColor" letter-spacing="0.06em">ADMISSIBLE</text>
${box(20, 40, 330, 44, "Observed request", "method, path, status, timing")}
${box(20, 92, 330, 44, "Request headers", "declared identity, stored as a claim")}
${box(20, 144, 330, 44, "Canary appearance", "coined string observed in the wild")}
${note(185, 214, "all re-checkable against the stored record")}

<line x1="380" y1="16" x2="380" y2="230" stroke="currentColor" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="3 4"/>

<text x="410" y="26" font-size="12" font-weight="700" fill="currentColor" fill-opacity="0.55" letter-spacing="0.06em">REFUSED</text>
${box(410, 40, 330, 44, "Model self-report", "the system under test describing itself", { dashed: true })}
${box(410, 92, 330, 44, "Inference stored as fact", "“this was a bot” written into the record", { dashed: true })}
${box(410, 144, 330, 44, "Unversioned conclusion", "cannot be re-derived later", { dashed: true })}
${note(575, 214, "no layer may validate itself with its own output")}
</svg>`;

  return figure({
    svg,
    caption:
      "The exclusion on the right is the expensive one. Asking a model what it knows about a site is the common way to measure AI visibility, and it is the system under test giving evidence about itself."
  });
}

/** The loop the observatory runs on. */
export function cycleDiagram() {
  const nodes = [
    ["Observe", 300, 52, "requests as they arrive"],
    ["Document", 470, 148, "record, never edit"],
    ["Archive", 405, 300, "history accumulates"],
    ["Analyze", 195, 300, "versioned reading"],
    ["Publish", 130, 148, "findings in public"]
  ];

  const arcs = nodes
    .map((n, i) => {
      const [, x1, y1] = n;
      const [, x2, y2] = nodes[(i + 1) % nodes.length];
      const cx = 300 + (x1 + x2 - 600) * 0.62;
      const cy = 180 + (y1 + y2 - 360) * 0.62;
      return `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.3" marker-end="url(#ah)"/>`;
    })
    .join("\n");

  const labels = nodes
    .map(
      ([label, x, y, sub]) => `<g>
<circle cx="${x}" cy="${y}" r="7" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-opacity="0.55"/>
<text x="${x}" y="${y - 16}" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor">${label}</text>
<text x="${x}" y="${y + 26}" text-anchor="middle" font-size="10.5" fill="currentColor" fill-opacity="0.6">${sub}</text>
</g>`
    )
    .join("\n");

  const svg = `<svg viewBox="0 0 600 370" width="600" height="370" class="dg" role="img" aria-labelledby="dg3t dg3d" xmlns="http://www.w3.org/2000/svg">
<title id="dg3t">The observation cycle</title>
<desc id="dg3d">Observe, document, archive, analyze, publish, and return to observe. Each pass adds to a history that gives later observations their context.</desc>
${DEFS}
${arcs}
${labels}
<text x="300" y="176" text-anchor="middle" font-size="11.5" fill="currentColor" fill-opacity="0.72" font-weight="600">History creates</text>
<text x="300" y="192" text-anchor="middle" font-size="11.5" fill="currentColor" fill-opacity="0.72" font-weight="600">context</text>
</svg>`;

  return figure({
    svg,
    caption:
      "Each pass through the loop adds to a record that makes the next pass sharper. A single observation says little; the same observation against two years of history is evidence."
  });
}

/** Declared identity versus observed behaviour. */
export function trustDiagram() {
  const svg = `<svg viewBox="0 0 760 260" width="760" height="260" class="dg" role="img" aria-labelledby="dg4t dg4d" xmlns="http://www.w3.org/2000/svg">
<title id="dg4t">How a declared identity becomes evidence</title>
<desc id="dg4d">A client declares an identity in its user agent string. Separately, its behaviour is observed: whether it fetched robots.txt, whether it then took a disallowed path, whether it executed JavaScript. The gap between what was declared and what was done is the measurable signal.</desc>
${DEFS}
${box(20, 34, 200, 58, "Declared identity", "User-Agent string")}
${note(120, 108, "a claim, never verified")}

${box(20, 150, 200, 58, "Observed behaviour", "what the client actually did")}
${note(120, 224, "recorded, re-checkable")}

${arrow(223, 63, 288, 105)}
${arrow(223, 179, 288, 137)}

${box(292, 92, 178, 58, "Compared", "declaration vs record", { solid: true })}
${arrow(473, 121, 520, 121)}

${box(523, 34, 217, 50, "Fetched robots.txt,", "then took a disallowed path")}
${box(523, 96, 217, 50, "Claimed a browser,", "never executed JavaScript")}
${box(523, 158, 217, 50, "Declared one crawler,", "behaved like another")}

<line x1="470" y1="121" x2="500" y2="121" stroke="none"/>
<path d="M500 121 L510 121 M510 59 L510 183" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2"/>
${arrow(510, 59, 520, 59)}
${arrow(510, 183, 520, 183)}
</svg>`;

  return figure({
    svg,
    caption:
      "Promise-keeping is measurable. A crawler that reads the rules and then ignores them has produced evidence about itself that no self-description can override — which is what makes behaviour, rather than declaration, the basis for trust."
  });
}
