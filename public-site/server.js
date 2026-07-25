import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

import captureHook, { recordJsExecution } from "./captureHook.js";
import {
  ensureCanaries,
  loadCanaries,
  canaryFor,
  allCanaries,
  ensureCanary,
  canaryPublishedAt
} from "./canary.js";
import { seedHumanFindings } from "./findings/seed.js";
import { runOnce } from "./findings/engine.js";
import { robotsTxt, sitemapXml } from "./robots.js";
import { indexNowKey } from "./geo/indexnow.js";
import * as content from "./pages/content.js";
import * as probes from "./pages/probes.js";
import { lab, methodology } from "./pages/lab.js";
import { observatory, constitution, about } from "./pages/observatory.js";
import {
  questionsIndex,
  questionPage,
  questionVariant
} from "./pages/questions.js";
import {
  findingsIndex,
  findingPage,
  findingVariant
} from "./pages/findings.js";
import { published as publishedFindings } from "./findings/engine.js";

// Public-facing process. Deliberately imports nothing from ../repositories or
// ../src: the private API on 127.0.0.1:3000 has unauthenticated routes and must
// never become reachable through the tunnel.

const PORT = Number(process.env.PUBLIC_SITE_PORT ?? 8080);
const HOST = "127.0.0.1";

const seeded = seedHumanFindings();
if (seeded > 0) console.log(`[findings] seeded ${seeded} hand-written finding(s)`);

const minted = ensureCanaries();
const canaries = loadCanaries();
const publishedAt = new Map(allCanaries().map((c) => [c.variant, c.publishedAt]));

if (minted.length > 0) {
  console.log(`[canary] minted ${minted.length} new marker(s):`);
  for (const m of minted) console.log(`  ${m.page} → ${m.token}`);
}

const app = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 65536
});

// Without a cap, anyone can write to reality.db as fast as they can issue
// requests, and the store grows until the disk does not. The limit is set well
// above what a well-behaved crawler needs so it never distorts the measurement;
// exceeding it produces a 429, which is itself recorded.
await app.register(rateLimit, {
  max: 240,
  timeWindow: "1 minute",
  // Behind the tunnel every socket is loopback, so the CDN-supplied address is
  // the only thing that distinguishes callers.
  keyGenerator: (req) =>
    req.headers["cf-connecting-ip"] ?? req.ip ?? "unknown",
  addHeadersOnExceeding: { "x-ratelimit-remaining": true },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: "Slow down. This site records every request; flooding it is recorded too."
  })
});

captureHook(app);

/** Tags the request so capture records which instrument served it. */
function serve(req, reply, variant, contentType, payload) {
  req.realityVariant = variant;
  req.realityCanary = canaryFor(variant);
  reply.type(contentType).send(payload);
}

function html(req, reply, variant, render) {
  req.realityVariant = variant;
  const token = canaryFor(variant);
  req.realityCanary = token;
  reply
    .type("text/html; charset=utf-8")
    .send(render(token, publishedAt.get(variant)));
}

app.get("/", (req, reply) => html(req, reply, "home", content.home));

app.get("/how-it-works", (req, reply) =>
  html(req, reply, "how_it_works", content.howItWorks)
);

app.get("/what-we-measure", (req, reply) =>
  html(req, reply, "what_we_measure", content.whatWeMeasure)
);

app.get("/observatory", (req, reply) =>
  html(req, reply, "observatory", observatory)
);

app.get("/constitution", (req, reply) =>
  html(req, reply, "constitution", constitution)
);

app.get("/about", (req, reply) => html(req, reply, "about", about));

app.get("/questions", (req, reply) =>
  html(req, reply, "questions", questionsIndex)
);

app.get("/questions/:slug", (req, reply) => {
  const variant = questionVariant(req.params.slug);
  if (!variant) return notFound(req, reply);
  html(req, reply, variant, (token, published) =>
    questionPage(req.params.slug, token, published)
  );
});

app.get("/findings", (req, reply) =>
  html(req, reply, "findings", findingsIndex)
);

app.get("/findings/:slug", (req, reply) => {
  const variant = findingVariant(req.params.slug);
  if (!variant) return notFound(req, reply);
  // Detector-published findings appear after boot, so their marker is minted
  // the first time the page is served rather than at startup.
  const token = ensureCanary(`/findings/${req.params.slug}`, variant);
  req.realityVariant = variant;
  req.realityCanary = token;
  reply
    .type("text/html; charset=utf-8")
    .send(findingPage(req.params.slug, token, canaryPublishedAt(variant)));
});

app.get("/lab", (req, reply) => html(req, reply, "lab", lab));

app.get("/lab/methodology", (req, reply) =>
  html(req, reply, "lab_methodology", methodology)
);

app.get("/glossary/:slug", (req, reply) => {
  const variant = content.glossaryVariant(req.params.slug);
  if (!variant) return notFound(req, reply);
  html(req, reply, variant, (token, published) =>
    content.glossary(req.params.slug, token, published)
  );
});

// Render-mode and format probes: identical content, different delivery.
app.get("/probe/html", (req, reply) =>
  html(req, reply, "probe_html", probes.probeHtml)
);

app.get("/probe/noscript", (req, reply) =>
  html(req, reply, "probe_noscript", probes.probeNoscript)
);

app.get("/probe/js", (req, reply) => {
  req.realityVariant = "probe_js";
  const token = canaryFor("probe_js");
  req.realityCanary = token;
  reply
    .type("text/html; charset=utf-8")
    .send(probes.probeJs(token, publishedAt.get("probe_js"), req.realityId));
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The only route through which an anonymous client can cause a write. A beacon
// is accepted only when it refers to a real, recent /probe/js response that has
// not already reported one — otherwise the same identifier could be replayed to
// manufacture evidence, or an invented one used to grow the table without
// bound.
app.get("/beacon.js", (req, reply) => {
  req.realityVariant = "beacon";
  const rid = typeof req.query?.rid === "string" ? req.query.rid : null;
  if (rid && UUID_RE.test(rid)) recordJsExecution(rid, req.headers);
  reply
    .type("application/javascript; charset=utf-8")
    .header("cache-control", "no-store")
    .send("/* execution recorded */\n");
});


app.get("/probe/data.json", (req, reply) =>
  serve(
    req,
    reply,
    "probe_json",
    "application/json; charset=utf-8",
    probes.probeJson(canaryFor("probe_json"), publishedAt.get("probe_json"))
  )
);

app.get("/probe/data.md", (req, reply) =>
  serve(
    req,
    reply,
    "probe_markdown",
    "text/markdown; charset=utf-8",
    probes.probeMarkdown(
      canaryFor("probe_markdown"),
      publishedAt.get("probe_markdown")
    )
  )
);

app.get("/probe/data.txt", (req, reply) =>
  serve(
    req,
    reply,
    "probe_text",
    "text/plain; charset=utf-8",
    probes.probeText(canaryFor("probe_text"), publishedAt.get("probe_text"))
  )
);

app.get("/feed.xml", (req, reply) =>
  serve(
    req,
    reply,
    "probe_feed",
    "application/rss+xml; charset=utf-8",
    probes.feedXml(canaryFor("probe_feed"), publishedAt.get("probe_feed"), publishedFindings())
  )
);

app.get("/llms.txt", (req, reply) =>
  serve(
    req,
    reply,
    "probe_llms_txt",
    "text/plain; charset=utf-8",
    probes.llmsTxt(
      canaryFor("probe_llms_txt"),
      publishedAt.get("probe_llms_txt")
    )
  )
);

// IndexNow requires the key to be retrievable at the site root; hosting it is
// what proves the announcement came from someone who controls this domain.
const INDEXNOW_KEY = indexNowKey();

app.get(`/${INDEXNOW_KEY}.txt`, (req, reply) => {
  req.realityVariant = "indexnow_key";
  reply.type("text/plain; charset=utf-8").send(INDEXNOW_KEY);
});

// Served dynamically so that fetching them is itself an observation.
app.get("/robots.txt", (req, reply) =>
  serve(req, reply, "robots_txt", "text/plain; charset=utf-8", robotsTxt())
);

app.get("/sitemap.xml", (req, reply) =>
  serve(
    req,
    reply,
    "sitemap_xml",
    "application/xml; charset=utf-8",
    sitemapXml()
  )
);

// Disallowed in robots.txt, yet serving ordinary content. A fetch is a measured
// compliance event, not a trap.
for (const path of content.disallowedPaths()) {
  const variant = content.disallowedVariant(path);
  app.get(path, (req, reply) =>
    html(req, reply, variant, (token, published) =>
      content.disallowed(path, token, published)
    )
  );
}

app.get("/health", (req, reply) => {
  req.realityVariant = "health";
  reply.type("application/json").send({ ok: true, canaries: canaries.size });
});

function notFound(req, reply) {
  req.realityVariant = req.realityVariant ?? "not_found";
  reply
    .code(404)
    .type("text/html; charset=utf-8")
    .send(content.notFound(req.raw?.url ?? "/"));
}

app.setNotFoundHandler(notFound);

// Detection runs on a timer so the site keeps producing findings without
// anyone driving it. Unref'd so it never holds the process open.
const DETECT_INTERVAL_MS = Number(process.env.DETECT_INTERVAL_MS ?? 15 * 60 * 1000);

function detectionPass() {
  try {
    const r = runOnce();
    if (r.published || r.pending || r.rejected) {
      console.log(
        `[findings] published ${r.published}, held ${r.pending}, rejected ${r.rejected}`
      );
    }
  } catch (err) {
    console.error("[findings] pass failed:", err.message);
  }
}

setTimeout(detectionPass, 10_000).unref();
setInterval(detectionPass, DETECT_INTERVAL_MS).unref();

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`public site listening on http://${HOST}:${PORT}`);
  console.log(`${canaries.size} markers live; reality recorded to reality.db`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
