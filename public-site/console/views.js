import { escapeHtml } from "../layout.js";

// Operator console. Deliberately unlike the public site: dense, monospaced,
// built to be scanned rather than read. This one is a tool, and it never leaves
// the loopback interface.

const STYLE = `
:root{--bg:#0e0f11;--panel:#16181c;--fg:#dfe3e8;--muted:#7d848e;--line:#262a30;
--ok:#4ea36a;--warn:#c99a3a;--bad:#c25a5a;--accent:#5b8dd6}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
header{border-bottom:1px solid var(--line);padding:.85rem 1.25rem;display:flex;
gap:1.25rem;align-items:baseline;flex-wrap:wrap;position:sticky;top:0;background:var(--bg);z-index:5}
header .brand{font-weight:700;letter-spacing:.04em}
header nav a{color:var(--muted);margin-right:1rem}
header nav a.on{color:var(--fg);border-bottom:1px solid var(--accent);padding-bottom:2px}
header .clock{margin-left:auto;color:var(--muted);font-size:11px}
main{padding:1.25rem;max-width:1400px}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);
margin:1.75rem 0 .6rem;font-weight:600}
h2:first-child{margin-top:0}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.7rem}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:.75rem .85rem}
.tile .v{font-size:1.7rem;font-weight:700;line-height:1.1}
.tile .k{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:.2rem}
.tile.hi .v{color:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:12px;background:var(--panel);
border:1px solid var(--line);border-radius:5px;overflow:hidden}
th{text-align:left;padding:.45rem .6rem;color:var(--muted);font-weight:600;font-size:10.5px;
text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:.4rem .6rem;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#1b1e23}
.scroll{overflow-x:auto}
.tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:10.5px;
border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.tag.ai{color:var(--accent);border-color:var(--accent)}
.tag.own{color:var(--warn);border-color:var(--warn)}
.tag.ok{color:var(--ok);border-color:var(--ok)}
.tag.bad{color:var(--bad);border-color:var(--bad)}
.filters{margin:.6rem 0 .9rem}
.filters a{margin-right:.9rem;color:var(--muted);font-size:12px}
.filters a.on{color:var(--fg);font-weight:700}
.alert{background:var(--panel);border-left:3px solid var(--warn);padding:.55rem .8rem;
margin-bottom:.5rem;border-radius:3px}
.alert.review{border-left-color:var(--accent)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:5px;
padding:.9rem 1rem;margin-bottom:.75rem}
.card h3{margin:.15rem 0 .4rem;font-size:14px}
.card p{margin:.35rem 0;color:var(--muted);line-height:1.55}
.meta{font-size:11px;color:var(--muted)}
form{display:inline}
button{font-family:inherit;font-size:11.5px;padding:.28rem .7rem;border-radius:4px;
border:1px solid var(--line);background:#1d2026;color:var(--fg);cursor:pointer;margin-right:.4rem}
button:hover{border-color:var(--accent)}
button.danger:hover{border-color:var(--bad);color:var(--bad)}
input[type=text]{font-family:inherit;font-size:11.5px;padding:.28rem .5rem;border-radius:4px;
border:1px solid var(--line);background:#1d2026;color:var(--fg);width:14rem}
.mono{font-family:inherit}
.dim{color:var(--muted)}
.trunc{max-width:34rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}
`;

const NAV = [
  ["/", "overview"],
  ["/requests", "requests"],
  ["/agents", "agents"],
  ["/findings", "findings"],
  ["/canaries", "canaries"]
];

export function shell(path, body, { refresh = 0 } = {}) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ""}
<title>observatory console</title>
<style>${STYLE}</style>
</head><body>
<header>
<span class="brand">OBSERVATORY CONSOLE</span>
<nav>${NAV.map(
    ([href, label]) =>
      `<a href="${href}" class="${href === path ? "on" : ""}">${label}</a>`
  ).join("")}</nav>
<span class="clock">${clock()} &middot; localhost only</span>
</header>
<main>${body}</main>
</body></html>`;
}

// Observations are stored in UTC and stay that way — a record read years from
// now must not depend on where the reader sits. But this console is one person
// looking at their own machine, and an unlabelled UTC timestamp beside a wall
// clock three hours ahead reads as a bug. So the record is UTC, the display is
// local, and every column that shows a time says which one it is.
const time = (iso) =>
  iso
    ? escapeHtml(
        new Date(iso).toLocaleTimeString("en-GB", { hour12: false })
      )
    : "—";
const date = (iso) =>
  iso ? escapeHtml(new Date(iso).toLocaleDateString("en-CA")) : "—";

const TZ = new Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Both readings, so the wall clock and the stored record can be reconciled. */
function clock() {
  const now = new Date();
  const local = now.toLocaleString("en-GB", { hour12: false }).replace(",", "");
  const utc = now.toISOString().slice(11, 19);
  return escapeHtml(`${local} ${TZ} · ${utc} UTC`);
}

function trunc(s, n) {
  const v = String(s ?? "");
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

const AI_RE =
  /(GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|meta-externalagent|Amazonbot|Bytespider|cohere-ai|Diffbot|YouBot|Timpibot)/i;

function agentTags(ua, ip, ownIps) {
  const tags = [];
  const ai = AI_RE.exec(ua ?? "");
  if (ai) tags.push(`<span class="tag ai">${escapeHtml(ai[1])}</span>`);
  if (ip && ownIps.has(ip)) tags.push(`<span class="tag own">own</span>`);
  return tags.join(" ");
}

export function healthView(rows) {
  return `<h2>observation health</h2>
<div class="scroll"><table>
<thead><tr><th>component</th><th>state</th><th></th><th>why it matters</th></tr></thead>
<tbody>
${rows
  .map(
    (r) => `<tr>
<td><strong>${escapeHtml(r.name)}</strong></td>
<td class="dim">${escapeHtml(r.detail)}</td>
<td><span class="tag ${r.ok ? "ok" : "bad"}">${r.ok ? "ok" : "ATTENTION"}</span></td>
<td class="dim">${escapeHtml(r.note)}</td>
</tr>`
  )
  .join("")}
</tbody></table></div>`;
}

export function integrityView(integrity) {
  return `<h2>epistemic integrity ${integrity.ok ? '<span class="tag ok">holding</span>' : '<span class="tag bad">BROKEN</span>'}</h2>
<div class="scroll"><table>
<thead><tr><th>separation</th><th></th><th>state</th><th>why it matters</th></tr></thead>
<tbody>
${integrity.checks
  .map(
    (c) => `<tr>
<td><strong>${escapeHtml(c.name)}</strong></td>
<td><span class="tag ${c.ok ? "ok" : "bad"}">${c.ok ? "ok" : "BROKEN"}</span></td>
<td class="dim">${escapeHtml(c.detail)}</td>
<td class="dim">${escapeHtml(c.why)}</td>
</tr>`
  )
  .join("")}
</tbody></table></div>
<p class="meta">Reality → Interpretation → Action → Reality. These checks ask whether that separation still holds, not whether a process is alive.</p>`;
}

export function overviewView(o, alerts, recent, ownIps, healthRows, integrity) {
  const tile = (v, k, hi = false) =>
    `<div class="tile${hi ? " hi" : ""}"><div class="v">${escapeHtml(String(v))}</div><div class="k">${escapeHtml(k)}</div></div>`;

  return `
${
  alerts.length
    ? `<h2>attention</h2>${alerts
        .map(
          (a) =>
            `<div class="alert ${a.level}"><a href="${a.href}">${escapeHtml(a.text)}</a></div>`
        )
        .join("")}`
    : ""
}

${integrity ? integrityView(integrity) : ""}

${healthRows ? healthView(healthRows) : ""}

<h2>record &mdash; external traffic only</h2>
<div class="tiles">
${tile(o.external.toLocaleString("en-US"), "requests", true)}
${tile(o.aiRequests, "credible AI hits", true)}
${tile(o.last24h, "last 24h")}
${tile(o.agents, "declared identities")}
${tile(o.ips, "addresses")}
${tile(o.countries, "countries")}
${tile(o.markers, "markers")}
${tile(o.jsBeacons, "js beacons")}
</div>

<h2>findings</h2>
<div class="tiles">
${tile(o.findings.published ?? 0, "published")}
${tile(o.findings.pending ?? 0, "held for review", (o.findings.pending ?? 0) > 0)}
${tile(o.findings.rejected ?? 0, "rejected")}
</div>

<h2>observing since ${date(o.since)} &middot; last request ${time(o.last)}</h2>

<h2>latest requests</h2>
${requestTable(recent, ownIps)}
<p class="meta"><a href="/requests">full feed</a></p>
`;
}

export function requestTable(rows, ownIps) {
  if (rows.length === 0) return `<p class="dim">nothing recorded</p>`;
  return `<div class="scroll"><table>
<thead><tr><th>time (local)</th><th>st</th><th>path</th><th>cc</th><th>address</th><th>agent</th><th>ms</th></tr></thead>
<tbody>
${rows
  .map(
    (r) => `<tr>
<td class="dim">${time(r.observedAt)}</td>
<td class="${r.responseStatus >= 400 ? "tag bad" : "dim"}">${r.responseStatus ?? "—"}</td>
<td>${escapeHtml(trunc(r.path, 40))}</td>
<td class="dim">${escapeHtml(r.cfIpCountry ?? "—")}</td>
<td class="dim">${escapeHtml(trunc(r.cfConnectingIp ?? "local", 22))}</td>
<td>${agentTags(r.userAgent, r.cfConnectingIp, ownIps)} <span class="dim">${escapeHtml(trunc(r.userAgent ?? "(none)", 46))}</span></td>
<td class="dim">${r.responseTimeMs != null ? r.responseTimeMs.toFixed(1) : "—"}</td>
</tr>`
  )
  .join("")}
</tbody></table></div>`;
}

export function requestsView(rows, filter, ownIps) {
  const f = (key, label) =>
    `<a href="/requests?filter=${key}" class="${filter === key ? "on" : ""}">${label}</a>`;
  return `
<h2>requests</h2>
<div class="filters">
${f("external", "all external")}${f("ai", "declared AI")}${f("disallowed", "disallowed paths")}${f("errors", "4xx/5xx")}${f("instrument", "instrument (ours)")}
</div>
${requestTable(rows, ownIps)}
<p class="meta">Every view here is external traffic. The last filter is the only way to see the instrument's own requests, and it shows nothing else — so the two populations are never mixed on one screen.</p>
`;
}

export function agentsView(rows, ownIps) {
  return `
<h2>declared agents &mdash; external traffic only</h2>
<div class="scroll"><table>
<thead><tr><th>agent</th><th>hits</th><th>paths</th><th>IPs</th><th>first</th><th>last</th><th></th></tr></thead>
<tbody>
${rows
  .map(
    (r) => `<tr>
<td><span class="trunc">${escapeHtml(trunc(r.userAgent, 70))}</span></td>
<td>${r.hits}</td><td>${r.paths}</td><td>${r.ips}</td>
<td class="dim">${date(r.firstAt)}</td><td class="dim">${date(r.lastAt)}</td>
<td>${AI_RE.test(r.userAgent ?? "") ? '<span class="tag ai">AI</span>' : ""}${r.viaCdn ? "" : ' <span class="tag">local</span>'}</td>
</tr>`
  )
  .join("")}
</tbody></table></div>
<p class="meta">A user agent is a claim. Counts here are counts of claims, not of verified identities.</p>
`;
}

export function findingsView({ pending, published, rejected }, claimsFor, status) {
  const f = (key, label, n) =>
    `<a href="/findings?status=${key}" class="${status === key ? "on" : ""}">${label} (${n})</a>`;

  const list =
    status === "published" ? published : status === "rejected" ? rejected : pending;

  return `
<h2>findings</h2>
<div class="filters">
${f("pending", "held for review", pending.length)}${f("published", "published", published.length)}${f("rejected", "rejected", rejected.length)}
</div>

<form method="post" action="/detect">
<button type="submit">run detection now</button>
</form>

${
  list.length === 0
    ? `<p class="dim" style="margin-top:1rem">nothing here</p>`
    : list
        .map((f2) => {
          const claims = claimsFor(f2.id);
          return `<div class="card">
<div class="meta">
<span class="tag ${f2.origin === "human" ? "" : "ai"}">${escapeHtml(f2.origin)}</span>
<span class="tag">${escapeHtml(f2.detectorId)}</span>
${f2.publishedAt ? `<span class="tag ok">published ${date(f2.publishedAt)}</span>` : ""}
${f2.rejectedReason ? `<span class="tag bad">${escapeHtml(trunc(f2.rejectedReason, 40))}</span>` : ""}
</div>
<h3>${escapeHtml(f2.title)}</h3>
<p>${escapeHtml(f2.summary)}</p>
${
  claims.length
    ? `<p class="meta">verified figures: ${claims
        .map(
          (c) =>
            `${escapeHtml(c.label)} = ${escapeHtml(c.expected)} <span class="tag ${c.ok ? "ok" : "bad"}">${c.ok ? "match" : "MISMATCH"}</span>`
        )
        .join(" &middot; ")}</p>`
    : ""
}
${
  f2.status === "pending"
    ? `<form method="post" action="/findings/${f2.id}/approve"><button type="submit">approve &amp; publish</button></form>
<form method="post" action="/findings/${f2.id}/reject">
<input type="text" name="reason" placeholder="reason" value="own test traffic">
<button type="submit" class="danger">reject</button></form>`
    : f2.status === "published"
      ? `<p class="meta"><a href="https://agentshieldaidefense.com/findings/${escapeHtml(f2.slug)}" target="_blank" rel="noopener">view public page →</a></p>`
      : ""
}
</div>`;
        })
        .join("")
}
`;
}

export function canariesView(rows) {
  return `
<h2>markers</h2>
<div class="scroll"><table>
<thead><tr><th>token</th><th>page</th><th>stage</th><th>published</th><th>fetched externally</th><th>observed in a model</th></tr></thead>
<tbody>
${rows
  .map(
    (r) => `<tr>
<td>${escapeHtml(r.token)}</td>
<td class="dim">${escapeHtml(r.page)}</td>
<td><span class="tag ${r.stage === "fetched" ? "ok" : ""}">${escapeHtml(r.stage)}</span></td>
<td class="dim">${date(r.publishedAt)}</td>
<td>${r.served}</td>
<td class="dim">—</td>
</tr>`
  )
  .join("")}
</tbody></table></div>
<p class="meta">Lifecycle is created → published → fetched → archived. Appearing in a model is not a stage: it may never happen, and a lifecycle whose end might never arrive is not one. The last column stays empty until a marker is observed in a model's output without live retrieval. That is the measurement; nothing has satisfied it yet.</p>
`;
}
