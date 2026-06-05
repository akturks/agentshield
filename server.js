import Fastify from "fastify";
import { z } from "zod";

import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import {
  createEvent
} from "./repositories/eventRepository.js";
import {
  calculateTrust
} from "./repositories/trustRepository.js";

import {
  deriveIntent
} from "./repositories/intentRepository.js";

import {
  makeDecision
} from "./repositories/policyRepository.js"
const app = Fastify();

import {
  determineEnforcement
} from "./repositories/enforcementRepository.js";

import {
  buildTrustAssessment
} from "./repositories/trustAssessmentRepository.js";

import {
  buildTrustRepresentation
} from "./repositories/trustRepresentationRepository.js";

const TENANTS = {
  "test_key_123": {
    tenantId: "tenant_1",
    name: "Demo Customer"
  }
};

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
  const apiKey = request.headers["x-api-key"];

  const tenant = TENANTS[apiKey];

  if (!tenant) {
    return reply.status(401).send({
      error: "unauthorized"
    });
  }

  const validation = EvaluateSchema.safeParse(
    request.body || {}
  );

  if (!validation.success) {
    return reply.status(400).send({
      error: "validation_failed",
      details: validation.error.issues
    });
  }

  const fingerprint =
    validation.data.userAgent;

  const identity =
    findOrCreateIdentity({
      tenantId: tenant.tenantId,
      fingerprint,
      identityType: "browser"
    });

  const result =
    evaluateRisk(validation.data);

const trust =
  calculateTrust(identity.id);

const intent =
  deriveIntent(
    trust.signals
  );

const policyDecision =
  makeDecision({
    trustScore:
      trust.trustScore,
    intent
  });

const enforcement =
  determineEnforcement({
    policyDecision,
    enforcementMode:
      "observe"
  });

const trustAssessment =
  buildTrustAssessment({
    identityId:
      identity.id,

    trustScore:
      trust.trustScore,

    signals:
      trust.signals,

    evidence:
      trust.evidence,

    intent
  });
const trustRepresentation =
  buildTrustRepresentation(
    trustAssessment
  );
  createEvent({
    identityId: identity.id,
    eventType: "request",
    path: validation.data.path,
    userAgent: validation.data.userAgent,
    riskScore: result.score,
    decision: result.decision
  });

  return {
  tenantId: tenant.tenantId,
  tenantName: tenant.name,
  identityId: identity.id,

  trustScore:
    trust.trustScore,

  signals:
    trust.signals,
  
evidence:
    trust.evidence,

trustAssessment,

trustRepresentation,

intent,

policyDecision,

enforcement,

legacyRisk:
  result,

  received:
    validation.data
};

});
try {
  await app.listen({
    port: 3000,
    host: "0.0.0.0"
  });

  console.log(
    "AgentShield API v0.9 identity memory enabled running on port 3000"
  );
} catch (err) {
  console.error(err);
  process.exit(1);
}
