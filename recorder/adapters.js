// Wiring for the three ways a Node site usually serves requests.
//
// Each adapter does the same thing: note when the request started, and write one
// row when the response has finished. Timing is taken at response end rather
// than at arrival, because a request that was still being served is not yet an
// observation of anything — and because the response status and byte count are
// the parts that say what the client actually got.

/**
 * Fastify. Register once, after any plugin that sets response headers.
 *
 *   import { fastifyRecorder } from "agentshield-recorder/adapters.js";
 *   fastifyRecorder(app, recorder);
 */
export function fastifyRecorder(app, recorder, { variant } = {}) {
  app.addHook("onRequest", (req, _reply, done) => {
    req.__recStart = process.hrtime.bigint();
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    recorder.record({
      headers: req.headers,
      method: req.method,
      url: req.raw?.url ?? req.url,
      httpVersion: req.raw?.httpVersion ?? null,
      remoteAddr: req.raw?.socket?.remoteAddress ?? null,
      status: reply.statusCode,
      responseBytes: reply.getHeader?.("content-length"),
      responseTimeMs: req.__recStart
        ? Number(process.hrtime.bigint() - req.__recStart) / 1e6
        : null,
      contentType: reply.getHeader?.("content-type") ?? null,
      routeVariant: typeof variant === "function" ? variant(req) : (variant ?? null)
    });
    done();
  });
}

/**
 * Express / Connect. Mount before your routes.
 *
 *   app.use(expressRecorder(recorder));
 */
export function expressRecorder(recorder, { variant } = {}) {
  return function recordMiddleware(req, res, next) {
    const started = process.hrtime.bigint();

    // 'finish' fires when the response has been handed to the socket. 'close'
    // covers the client hanging up first — that is still an observation, and a
    // request that was abandoned halfway is worth being able to count.
    let written = false;
    const write = () => {
      if (written) return;
      written = true;
      recorder.record({
        headers: req.headers,
        method: req.method,
        url: req.originalUrl ?? req.url,
        httpVersion: req.httpVersion,
        remoteAddr: req.socket?.remoteAddress ?? null,
        status: res.statusCode,
        responseBytes: res.getHeader?.("content-length"),
        responseTimeMs: Number(process.hrtime.bigint() - started) / 1e6,
        contentType: res.getHeader?.("content-type") ?? null,
        routeVariant: typeof variant === "function" ? variant(req) : (variant ?? null)
      });
    };

    res.on("finish", write);
    res.on("close", write);
    next();
  };
}

/**
 * Plain node:http, for a server built without a framework.
 *
 *   const server = http.createServer(handler);
 *   nodeRecorder(server, recorder);
 */
export function nodeRecorder(server, recorder, { variant } = {}) {
  server.on("request", (req, res) => {
    const started = process.hrtime.bigint();
    let written = false;
    const write = () => {
      if (written) return;
      written = true;
      recorder.record({
        headers: req.headers,
        method: req.method,
        url: req.url,
        httpVersion: req.httpVersion,
        remoteAddr: req.socket?.remoteAddress ?? null,
        status: res.statusCode,
        responseBytes: res.getHeader?.("content-length"),
        responseTimeMs: Number(process.hrtime.bigint() - started) / 1e6,
        contentType: res.getHeader?.("content-type") ?? null,
        routeVariant: typeof variant === "function" ? variant(req) : (variant ?? null)
      });
    };
    res.on("finish", write);
    res.on("close", write);
  });
}
