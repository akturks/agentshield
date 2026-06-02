import Fastify from "fastify";

const app = Fastify();

app.get("/health", async () => {
  return {
    status: "ok",
    service: "agentshield"
  };
});

app.post("/v1/evaluate", async (request) => {
  const body = request.body || {};

  return {
    score: 12,
    confidence: 0.91,
    decision: "allow",
    received: body
  };
});

try {
  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  console.log("AgentShield API v0.1 running on port 3000");
} catch (err) {
  console.error(err);
  process.exit(1);
}
