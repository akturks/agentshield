import Fastify from "fastify";
import formbody from "@fastify/formbody";

import * as q from "./queries.js";
import * as v from "./views.js";
import { runOnce, approve, reject } from "../findings/engine.js";

// Operator console. Binds to loopback and is never routed through the tunnel:
// it exposes raw operational data and it can publish, so putting it on the
// public interface would hand a stranger the approve button.
//
// It is also not part of the observatory's own record — the public capture hook
// does not run here, so opening a page on this console never adds a row to
// RequestReality and never contaminates what the site is measuring.

const PORT = Number(process.env.DASHBOARD_PORT ?? 8090);
const HOST = "127.0.0.1";

const app = Fastify({ logger: false, bodyLimit: 32768 });
await app.register(formbody);

app.addHook("onRequest", (req, reply, done) => {
  reply.header("X-Robots-Tag", "noindex, nofollow");
  done();
});

app.get("/", (req, reply) => {
  const ownIps = q.operatorIps();
  reply
    .type("text/html; charset=utf-8")
    .send(
      v.shell(
        "/",
        v.overviewView(
          q.overview(),
          q.alerts(),
          q.recentRequests({ limit: 25 }),
          ownIps,
          q.health(),
          q.epistemicIntegrity(),
          q.integrityStamp()
        ),
        { refresh: 20 }
      )
    );
});

app.get("/requests", (req, reply) => {
  const filter = String(req.query?.filter ?? "all");
  reply
    .type("text/html; charset=utf-8")
    .send(
      v.shell(
        "/requests",
        v.requestsView(
          q.recentRequests({ limit: 200, filter }),
          filter,
          q.operatorIps()
        ),
        { refresh: 30 }
      )
    );
});

app.get("/agents", (req, reply) => {
  reply
    .type("text/html; charset=utf-8")
    .send(v.shell("/agents", v.agentsView(q.agentBreakdown(), q.operatorIps())));
});

app.get("/findings", (req, reply) => {
  const status = String(req.query?.status ?? "pending");
  reply.type("text/html; charset=utf-8").send(
    v.shell(
      "/findings",
      v.findingsView(
        {
          pending: q.findingsByStatus("pending"),
          published: q.findingsByStatus("published"),
          rejected: q.findingsByStatus("rejected")
        },
        q.findingClaims,
        status
      )
    )
  );
});

app.get("/canaries", (req, reply) => {
  reply
    .type("text/html; charset=utf-8")
    .send(v.shell("/canaries", v.canariesView(q.canaries())));
});

app.post("/detect", (req, reply) => {
  const r = runOnce({ verbose: true });
  console.log(
    `[console] detect: published ${r.published}, held ${r.pending}, rejected ${r.rejected}, known ${r.skipped}`
  );
  reply.redirect("/findings?status=pending");
});

app.post("/findings/:id/approve", (req, reply) => {
  approve(req.params.id);
  console.log(`[console] approved ${req.params.id}`);
  reply.redirect("/findings?status=published");
});

app.post("/findings/:id/reject", (req, reply) => {
  reject(req.params.id, req.body?.reason || "rejected by review");
  console.log(`[console] rejected ${req.params.id}: ${req.body?.reason ?? ""}`);
  reply.redirect("/findings?status=rejected");
});

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`observatory console: http://${HOST}:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
