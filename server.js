import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import db from "./repositories/db.js";
import {
  getTenantByApiKey
} from "./repositories/apiKeyRepository.js";

  import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import {
  createSession,
  getSession
} from "./repositories/sessionRepository.js";

import {
  createOutcome,
  getAllOutcomes,
  getOutcomesByIdentity,
  getOutcomesBySession,
  getOutcomesByCorrelationId
} from "./repositories/outcomeRepository.js";

import {
  createEvent,
  getAllEvents,
  getEventsByIdentity,
  getEventsBySession,
  getSessionProfile
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

const tenantExists =
  db.prepare(`
    SELECT id
    FROM Tenant
    WHERE id = ?
    LIMIT 1
  `).get("tenant_1");

if (!tenantExists) {

  db.prepare(`
    INSERT INTO Tenant (
      id,
      name,
      createdAt
    )
    VALUES (
      ?,
      ?,
      datetime('now')
    )
  `).run(
    "tenant_1",
    "Demo Customer"
  );

  console.log(
    "Bootstrap: Demo tenant created"
  );
}


import {
  determineEnforcement
} from "./repositories/enforcementRepository.js";

import {
  buildTrustAssessment
} from "./repositories/trustAssessmentRepository.js";

import {
  buildTrustRepresentation
} from "./repositories/trustRepresentationRepository.js";

import {
  saveAssessment,
  getAssessmentsByIdentity,
  getIdentityProfile,
  getAllIdentityProfiles
} from "./repositories/assessmentRepository.js";

import {
  classify
} from "./src/services/riskClassificationService.js";

import dashboardRoutes
  from "./routes/dashboardRoutes.js";

import systemModeRoutes
  from "./routes/systemModeRoutes.js";

import investigationRoutes
  from "./routes/investigationRoutes.js";

import timelineRoutes
  from "./routes/timelineRoutes.js";

import outcomeRoutes
  from "./routes/outcomeRoutes.js";

import identityRoutes
  from "./routes/identityRoutes.js";

import sessionRoutes
  from "./routes/sessionRoutes.js";

import analyticsRoutes
  from "./routes/analyticsRoutes.js";

import replayRoutes
  from "./routes/replayRoutes.js";

import {
  allocate
} from "./src/services/allocationEngineService.js";

import {
  evaluatePolicy
} from "./src/services/policyEngineService.js";

import {
  enforce
} from "./src/services/enforcementEngineService.js";

import {
  evaluateOutcome
} from "./src/services/outcomeEngineService.js";

import {
  generateFeedback
} from "./src/services/feedbackEngineService.js";

import {
  evaluateLearning
} from "./src/services/learningEngineService.js";

import {
  applyTrustUpdate
} from "./src/services/trustUpdateEngineService.js";

import {
  evaluatePipeline
} from "./src/services/evaluatePipelineService.js";

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}

const app = Fastify();

await app.register(cors, {
  origin: true
});

await app.register(
  systemModeRoutes
);

app.register(
  dashboardRoutes
);

app.register(
  investigationRoutes
);

app.register(
  timelineRoutes
);

app.register(
  async function (app) {
    await outcomeRoutes(
      app,
      {
        OutcomeSchema
      }
    );
  }
);

app.register(
  async function (app) {
    await analyticsRoutes(
      app,
      {
        classify,
        evaluatePolicy,
        allocate,
        enforce,
        evaluateOutcome,
        generateFeedback,
        evaluateLearning,
        applyTrustUpdate
      }
    );
  }
);

app.register(
  replayRoutes
);

app.register(
  async function (app) {
    await identityRoutes(
      app,
      {
        classify,
        evaluatePolicy,
        allocate,
        enforce,
        evaluateOutcome,
        generateFeedback,
        evaluateLearning,
        applyTrustUpdate
      }
    );
  }
);

app.register(
  async function (app) {
await sessionRoutes(
  app
);
  }
);


const EvaluateSchema = z.object({
  userAgent: z.string().min(1),

  path: z.string().min(1),

  referrer: z.string().optional(),

  sessionId: z.string().optional(),

  correlationId:
    z.string().optional(),

  mouseMoves:
    z.number().optional(),

  scrollDepth:
    z.number().optional(),

  clickCount:
    z.number().optional(),

  focusEvents:
    z.number().optional(),

  readingTime:
    z.number().optional(),

  deviceFingerprint:
    z.string().optional(),

  challengeResult:
    z.string().optional()
});



const OutcomeSchema = z.object({
  outcomeType: z.string().min(1),

  source: z.string().min(1),

  confidence: z.number()
    .min(0)
    .max(1)
    .optional(),

  identityId: z.string().min(1),  

  sessionId: z.string().optional(),

  correlationId: z.string().optional()
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

const tenant =
  getTenantByApiKey(
    apiKey
  );

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

const pipelineResult =
  await evaluatePipeline({
    validation,
    tenant,

    findOrCreateIdentity,
    getSession,
    createSession,

    evaluateRisk,

    calculateTrust,
    deriveIntent,

    makeDecision,
    determineEnforcement,

    buildTrustAssessment,
    saveAssessment,

    buildTrustRepresentation,

    createEvent,
    createOutcome
  });

if (
  pipelineResult.error ===
  "session_identity_mismatch"
) {
  return reply
    .status(409)
    .send({
      error:
        "session_identity_mismatch"
    });
}

if (
  tenant.enforcementMode ===
  "ENFORCE"
) {

  if (
    pipelineResult.policyDecision ===
    "CHALLENGE"
  ) {
    await sleep(2000);
  }

  if (
    pipelineResult.policyDecision ===
    "THROTTLE"
  ) {
    await sleep(5000);
  }
}

return pipelineResult;

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
