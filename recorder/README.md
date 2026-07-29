# Request recorder

Records every request that reaches your server, so the question *"do AI systems
actually read my site?"* has an answer that comes from your own machine rather
than from asking a model what it did.

This is the half of the observatory that has to run on **your** site. Nobody can
tell you whether a crawler read your pages by looking at their own logs.

## Why it exists

A site owner asks why their pages never appear in AI answers, and gets advice:
check robots.txt, check your headers, check indexing. All of it assumes the
answer is on the owner's side. Often it is not, and without a record there is no
way to tell — so people change things that were never wrong.

With a record you can distinguish, on day one:

- **nothing arrives** — the retrieval step never pointed at you
- **rules arrive, pages do not** — you are being catalogued, not read
- **pages arrive** — you are read, and the problem is somewhere else entirely

Those are three different problems with three different answers, and they look
identical from outside.

## Install

Requires Node 18+ and `better-sqlite3`.

```bash
npm install better-sqlite3
```

Copy the `recorder/` directory into your project.

### Fastify

```js
import { createRecorder } from "./recorder/recorder.js";
import { fastifyRecorder } from "./recorder/adapters.js";

const recorder = createRecorder({ file: "./record.db" });
fastifyRecorder(app, recorder);
```

### Express

```js
import { createRecorder } from "./recorder/recorder.js";
import { expressRecorder } from "./recorder/adapters.js";

const recorder = createRecorder({ file: "./record.db" });
app.use(expressRecorder(recorder));
```

### node:http

```js
import { nodeRecorder } from "./recorder/adapters.js";
nodeRecorder(server, recorder);
```

Behind a proxy you control and that is *not* Cloudflare, pass
`trustForwarded: true` so the client address is taken from `x-forwarded-for`.
Leave it off otherwise: that header is client-settable, and an address taken
from it is a claim rather than a fact.

## Reading it

```bash
node recorder/cli.js summary        ./record.db
node recorder/cli.js ai             ./record.db
node recorder/cli.js agents         ./record.db
node recorder/cli.js paths          ./record.db
node recorder/cli.js corroboration  ./record.db
```

`ai` is the one that matters. It splits requests declaring an AI reader into
those that asked for **rules** — `robots.txt`, `sitemap.xml`, `llms.txt` — and
those that asked for a **page you wrote**. A crawler that takes the rules and
never returns has read nothing of yours, and that is invisible in a hit count.

## What a user agent is worth

Nothing, on its own.

On the observatory's own record, a single address presented **thirteen** crawler
identities belonging to ten companies inside seven seconds, while requesting
`/.git/config`, `/.env` and `/serviceAccountKey.json`. Every one of those would
appear in `agents` as a visit from Google, OpenAI, Anthropic and the rest.

Establishing which declarations are real means resolving each connecting address
against the address list its vendor publishes, captured on a fixed date so the
answer reproduces later. That check is not in this package, and `corroboration`
says so rather than implying otherwise.

Until you run it, read every identity in these tables as *declared*.

## What is recorded

Per request: time, method, path, query string, response status and size, how
long it took, the connecting address, the country a CDN reports for it, and the
request headers — user agent, accepted languages and encodings, referer.

**The connecting address is personal data** under GDPR and KVKK. It is recorded
because it is the only thing that separates one caller from another, and nearly
every question here depends on that separation.

## What is not recorded

The values of `Cookie`, `Set-Cookie`, `Authorization` and `Proxy-Authorization`
are replaced with `[redacted]` before the row is written. The header **name** is
kept, because which headers a client sends is behaviour and worth measuring;
what the value contains is not yours.

This is not configurable, and the reason is that the observatory ran for three
days without it and accumulated 520 stored cookie values carrying a persistent
per-visitor identifier that nothing ever read. Nobody chose to collect them. The
capture was written to keep everything, and keeping everything is not the same
as observing.

## Before you turn it on

You are about to start recording personal data. Two things, neither expensive:

1. **Publish a notice** saying what is recorded, why, for how long, and how to
   reach you. `PRIVACY.md` in this directory is a template — the important part
   is that it must be *true*. A notice claiming you process no personal data
   when you record IP addresses is worse than no notice at all.
2. **Decide a retention period**, or decide deliberately that there is none and
   write down why. Indefinite retention is defensible when the record's purpose
   requires it; it is not defensible by accident.

## Guarantees

- **It never throws into your response path.** If the database is unavailable
  the request is served normally and the row is lost. `recorder.stats()` reports
  how many rows were dropped.
- **It never updates or deletes.** No code path in this package modifies a
  stored row.
- **It sends nothing anywhere.** No network calls, no telemetry, no external
  service. The file stays on your machine.
