import Fastify from "fastify";

const app = Fastify();

function evaluateRisk(payload) {
  let score = 0;

  const userAgent = (payload.userAgent || "").toLowerCase();
  const path = (payload.path || "").toLowerCase();

  if (!userAgent) {
    score += 30;
  }

  if (userAgent.includes("curl")) {
    score += 50;
  }

  if (userAgent.includes("wget")) {
    score += 50;
  }

  if (path.includes("/login")) {
    score += 10;
  }

  if (path.includes("/admin")) {
    score += 20;
  }

  let decision = "allow";

  if (score >= 70) {
    decision = "block";
  } else if (score >= 40) {
    decision = "challenge";
  }

  return {
    score,
    decision
  };
}

app.get("/health", async () => {
  return {
    status: "ok",
    service: "agentshield"
  };
});

app.post("/v1/evaluate", async (request) => {
  const body = request.body || {};

  const result = evaluateRisk(body);

  return {
    ...result,
    received: body
  };
});

try {
  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  console.log("AgentShield API v0.2 running on port 3000");
} catch (err) {
  console.error(err);
  process.exit(1);
}
