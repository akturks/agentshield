import Fastify from "fastify";
import { z } from "zod";

const app = Fastify();
const EvaluateSchema = z.object({
  userAgent: z.string().min(1),
  path: z.string().min(1)
});

function evaluateRisk(payload) {
  let score = 0;
const reasons = [];

  const userAgent = (payload.userAgent || "").toLowerCase();
  const path = (payload.path || "").toLowerCase();

if (!userAgent) {
  score += 30;
  reasons.push("missing_user_agent");
}

if (userAgent.includes("curl")) {
  score += 50;
  reasons.push("curl_user_agent");
}

 if (userAgent.includes("wget")) {
  score += 50;
  reasons.push("wget_user_agent");
}

  if (path.includes("/login")) {
  score += 10;
  reasons.push("login_path");
}
  if (path.includes("/admin")) {
  score += 20;
  reasons.push("admin_path");
}

  let decision = "allow";

  if (score >= 70) {
    decision = "block";
  } else if (score >= 40) {
    decision = "challenge";
  }

return {
  score,
  decision,
  reasons
};
}

app.get("/health", async () => {
  return {
    status: "ok",
    service: "agentshield"
  };
});

app.post("/v1/evaluate", async (request, reply) => {
  const validation = EvaluateSchema.safeParse(
    request.body || {}
  );

  if (!validation.success) {
    return reply.status(400).send({
      error: "validation_failed",
      details: validation.error.issues
    });
  }

  const result = evaluateRisk(validation.data);

  return {
    ...result,
    received: validation.data
  };
});

try {
  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

console.log("AgentShield API v0.4 running on port 3000");
} catch (err) {
  console.error(err);
  process.exit(1);
}
