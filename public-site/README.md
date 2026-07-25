# public-site

The public surface of `agentshieldaidefense.com`: a small server that publishes
the site and records every inbound request as observed fact.

It is a **separate process** from the private API in `../server.js` and imports
nothing from `../repositories` or `../src`. That boundary is deliberate — nearly
every route on the private API is unauthenticated (including
`POST /v1/system-mode`), so it binds to `127.0.0.1` and must never be reachable
through the tunnel.

## Run

```bash
cd /Users/serdar/projects/agentshield
node public-site/server.js          # listens on 127.0.0.1:8080
```

Canary markers are minted on first boot and never rewritten afterwards, because
their `publishedAt` is the clock every ingestion measurement depends on.

## Deploy

```bash
cloudflared tunnel login                     # interactive, opens a browser
bash public-site/deploy/setup-tunnel.sh      # tunnel + DNS + config
bash public-site/deploy/install-services.sh  # launchd, restarts on crash
sudo pmset -a sleep 0 disablesleep 1         # sleep = an observation gap
```

In the Cloudflare dashboard, **"Block AI Scrapers and Crawlers" must be OFF**.
Blocking the crawlers would defeat the entire measurement.

## Operator console

A separate process on `127.0.0.1:8090`, deliberately not routed through the
tunnel — it can publish findings, so it must not be reachable from outside this
machine.

```bash
node public-site/console/server.js     # then open http://127.0.0.1:8090
```

It shows the live request feed, declared agents, the marker table, and the
findings queue with approve/reject buttons. Requests to the console are **not**
recorded into `RequestReality`: the capture hook does not run there, so using it
never contaminates what the site is measuring.

Traffic from addresses that have also sent `curl`, `wget` or a bare HTTP library
is tagged `own` — that is almost certainly your own testing, and the detectors
exclude it. Getting this wrong once produced eight false findings.

## Findings pipeline

`detect → draft → verify → publish`, run every 15 minutes by the site process
and on demand from the console or the CLI.

```bash
node public-site/findings/cli.js run       # one pass
node public-site/findings/cli.js list      # published and held
node public-site/findings/cli.js show <id> # with every checked figure
node public-site/findings/cli.js recheck   # do published figures still hold
```

Detectors emit figures paired with the query that produced them. Templates turn
a candidate into prose without touching the figures. The verifier recomputes
every figure against the record, and one mismatch discards the draft entirely —
which is what would make it safe to let a language model write the prose later,
since nothing it produced could move a number past that check.

Detectors that restate a count publish themselves. Detectors that say something
unflattering about a named actor (`robots_violation`, `identity_inconsistency`)
wait for a person.

## Layout

| File | Role |
| --- | --- |
| `server.js` | Fastify process, route table |
| `captureHook.js` | Records every request; never throws into the response path |
| `realityDb.js` | Opens `../reality.db` (WAL, absolute path) |
| `schema.sql` | `RequestReality`, `CanaryToken`, `JsExecution` |
| `canary.js` | Mints and serves the coined markers |
| `layout.js` | Page shell, styles, HTML escaping |
| `robots.js` | `robots.txt` and `sitemap.xml`, both served dynamically |
| `pages/content.js` | Home, explainers, glossary, disallowed paths, 404 |
| `pages/lab.js` | `/lab` live figures and `/lab/methodology` |
| `pages/probes.js` | Render-mode and format variants |
| `pages/findings.js` | Renders findings from the store |
| `findings/detectors.js` | Deterministic rules over reality |
| `findings/templates.js` | Candidate → prose, no model involved |
| `findings/verifier.js` | Recomputes every asserted figure |
| `findings/engine.js` | Orchestration and the publication gate |
| `console/` | Operator console (loopback only) |
| `migrate.js` | Idempotent schema migrations |

## The rules this code follows

From `../docs/CONSTITUTION.md` and `../SYSTEM_OF_RECORD.md`:

- **Reality is not interpretation.** `RequestReality` rows hold observation only
  — no score, no verdict, no `bot` label. Rows are INSERT-only and are never
  updated, so any conclusion drawn from them stays checkable.
- **Interpretation is versioned.** Signals derived from reality carry an
  interpreter version and live in their own table, so improving the interpreter
  means recomputing over the same untouched history rather than backfilling.
- **No layer validates itself.** A model's account of what it knows is never
  recorded as evidence. Ingestion is measured by publishing a coined string at a
  known instant and observing whether it appears.

Two consequences worth keeping in mind when editing:

- `/lab` renders `User-Agent` strings from arbitrary internet clients. Escape
  everything through `escapeHtml` in `layout.js`.
- Content pages ship no JavaScript. `/probe/js` is the single exception, where
  script execution is the variable being measured rather than a dependency.

## Reading the record

```bash
sqlite3 reality.db "SELECT observedAt, method, path, responseStatus,
  substr(userAgent,1,40) FROM RequestReality ORDER BY observedAtMs DESC LIMIT 20;"

sqlite3 reality.db "SELECT userAgent, COUNT(*) FROM RequestReality
  GROUP BY userAgent ORDER BY 2 DESC;"

sqlite3 reality.db "SELECT token, page, publishedAt FROM CanaryToken;"
```
