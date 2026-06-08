import Fastify from "fastify";
import { z } from "zod";

import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import {
  createSession,
  getSession
} from "./repositories/sessionRepository.js";

import {
  createOutcome
} from "./repositories/outcomeRepository.js";

import {
  createEvent,
  getAllEvents,
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

import {
  saveAssessment,
  getAssessmentsByIdentity,
  getIdentityProfile,
  getAllIdentityProfiles
} from "./repositories/assessmentRepository.js";

import {
  classify
} from "./src/services/riskClassificationService.js";

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

const TENANTS = {
  "test_key_123": {
    tenantId: "tenant_1",
    name: "Demo Customer",

    enforcementMode:
      "observe",

    lowTrafficValue: 5,
    mediumTrafficValue: 25,
    highTrafficValue: 100
  }
};

const EvaluateSchema = z.object({
  userAgent: z.string().min(1),
  path: z.string().min(1),
  referrer: z.string().optional(),
  sessionId: z.string().optional()
});

const OutcomeSchema = z.object({
  outcomeType: z.string().min(1),

  source: z.string().min(1),

  confidence: z.number()
    .min(0)
    .max(1)
    .optional(),

  identityId: z.string().optional(),

  sessionId: z.string().optional()
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

let session =
  getSession(
    validation.data.sessionId
  );

if (
  !session &&
  validation.data.sessionId
) {
  session =
    createSession({
      id:
        validation.data.sessionId,

      identityId:
        identity.id
    });
}

if (
  session &&
  session.identityId !==
    identity.id
) {
  return reply
    .status(409)
    .send({
      error:
        "session_identity_mismatch"
    });
}

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
      tenant.enforcementMode
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

saveAssessment({
  identityId:
    identity.id,

  trustScore:
    trustAssessment.trustScore,

  confidence:
    trustAssessment.confidence,

  intent:
    trustAssessment
      .intentAssessment
      .intent,

  assessmentTimestamp:
    trustAssessment
      .assessmentTimestamp
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
    referrer: validation.data.referrer,
    sessionId: validation.data.sessionId,
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

app.post(
  "/v1/outcomes",
  async (request, reply) => {
    const validation =
      OutcomeSchema.safeParse(
        request.body || {}
      );

    if (!validation.success) {
      return reply.status(400).send({
        error: "validation_failed",
        details:
          validation.error.issues
      });
    }

    const outcome =
      createOutcome({
        outcomeType:
          validation.data.outcomeType,

        source:
          validation.data.source,

        confidence:
          validation.data.confidence ??
          1.0,

        identityId:
          validation.data.identityId,

        sessionId:
          validation.data.sessionId
      });

    return {
      status: "recorded",
      outcome
    };
  }
);

app.get(
  "/v1/identities/:identityId/assessments",
  async (request) => {
    const assessments =
      getAssessmentsByIdentity(
        request.params.identityId
      );

    return {
      identityId:
        request.params.identityId,

      assessments
    };
  }
);

app.get(
  "/v1/identities/:identityId/profile",
  async (request, reply) => {
    const profile =
      getIdentityProfile(
        request.params.identityId
      );

    if (!profile) {
      return reply
        .status(404)
        .send({
          error:
            "identity_not_found"
        });
    }

const risk =
  classify(profile);

const policy =
  evaluatePolicy(risk);

const allocation =
  allocate(risk);

const enforcement =
  enforce(
    policy,
    allocation
  );

const outcome =
  evaluateOutcome(
    enforcement
  );

const feedback =
      generateFeedback(
    outcome
  );

const learning =
  evaluateLearning(
    outcome
  );

const trustUpdate =
  applyTrustUpdate(
    profile.currentTrustScore,
    feedback
  );

return {
  ...profile,
  risk,
  policy,
  allocation,
  enforcement,
  outcome,
  feedback,
  learning,
  trustUpdate
};

  }
);

app.get(
  "/v1/identities",
  async () => {
    const identities =
      getAllIdentityProfiles();

    return {
      identities
    };
  }
);

app.get(
  "/v1/identities/high-risk",
  async () => {
    const identities =
      getAllIdentityProfiles();

    const highRiskIdentities =
      identities
        .map(profile => ({
          ...profile,
          risk: classify(profile)
        }))
        .filter(
          identity =>
            identity.risk.riskLevel === "high" ||
            identity.risk.riskLevel === "critical"
        )
        .sort(
          (a, b) =>
            b.risk.riskScore -
            a.risk.riskScore
        );


    return {
      identities:
        highRiskIdentities
    };
  }
);

app.get(
  "/v1/events",
  async () => {
    const events =
      getAllEvents();

    return {
      events
    };
  }
);

app.get(
  "/v1/traffic-quality",
  async () => {
    const events =
      getAllEvents();

    const totalEvents =
      events.length;

    const blockedEvents =
      events.filter(
        event =>
          event.decision ===
          "block"
      ).length;

    const allowedEvents =
      events.filter(
        event =>
          event.decision ===
          "allow"
      ).length;

const averageRisk =
  totalEvents > 0
    ? events.reduce(
        (sum, event) =>
          sum + (event.riskScore || 0),
        0
      ) / totalEvents
    : 0;

const blockRate =
  totalEvents > 0
    ? (
        blockedEvents /
        totalEvents
      ) * 100
    : 0;
return {
  totalEvents,
  blockedEvents,
  allowedEvents,
  blockRate,
  averageRisk
};


  }
);

app.get(
  "/v1/sessions/:sessionId",
  async (request) => {
    const events =
      getEventsBySession(
        request.params.sessionId
      );

    return {
      sessionId:
        request.params.sessionId,

      events
    };
  }
);

app.get(
  "/v1/sessions/:sessionId/profile",
  async (request, reply) => {
    const profile =
      getSessionProfile(
        request.params.sessionId
      );

    if (!profile) {
      return reply
        .status(404)
        .send({
          error:
            "session_not_found"
        });
    }
    
   const tenant =
  TENANTS["test_key_123"];

let estimatedValue = 0;

if (
  profile.trafficTier ===
  "low"
) {
  estimatedValue =
    tenant.lowTrafficValue;
}

if (
  profile.trafficTier ===
  "medium"
) {
  estimatedValue =
    tenant.mediumTrafficValue;
}

if (
  profile.trafficTier ===
  "high"
) {
  estimatedValue =
    tenant.highTrafficValue;
}

return {
  ...profile,
  estimatedValue
};
  }
);

app.get(
  "/v1/risk-queue",
  async () => {
    const identities =
      getAllIdentityProfiles();

    const queue =
      identities
        .map(profile => {
          const risk =
            classify(profile);
 
 const policy =
  evaluatePolicy(risk);

const allocation =
  allocate(risk);


const enforcement =
  enforce(
    policy,
    allocation
  );

const outcome =
  evaluateOutcome(
    enforcement
  );

const feedback =
  generateFeedback(
    outcome
  );

const learning =
  evaluateLearning(
    outcome
  );

const trustUpdate =
  applyTrustUpdate(
    profile.currentTrustScore,
    feedback
  );
            
          let priority =
            "normal";

          if (
            risk.riskLevel ===
            "critical"
          ) {
            priority =
              "urgent";
          } else if (
            risk.riskLevel ===
            "high"
          ) {
            priority =
              "high";
          }

          return {
            identityId:
              profile.identityId,

            trustScore:
              profile.currentTrustScore,

            riskScore:
              risk.riskScore,

            riskLevel:
              risk.riskLevel,

priority,

policy,

allocation,

enforcement,

outcome,

feedback,

learning,

trustUpdate

          };
        })
        .filter(
          item =>
            item.riskLevel !==
            "low"
        )
        .sort(
          (a, b) =>
            b.riskScore -
            a.riskScore
        )
        .map(
          (item, index) => ({
            rank:
              index + 1,

            ...item
          })
        );

    return {
      items: queue
    };
  }
);

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
