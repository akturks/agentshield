export async function evaluatePipeline({
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
}) {

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
    return {
      error:
        "session_identity_mismatch"
    };
  }

  const result =
    evaluateRisk(
      validation.data
    );

  const trust =
    calculateTrust(
      identity.id
    );

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
    identityId:
      identity.id,

    eventType:
      "request",

    path:
      validation.data.path,

    userAgent:
      validation.data.userAgent,

    referrer:
      validation.data.referrer,

    sessionId:
      validation.data.sessionId,

    riskScore:
      result.score,

    decision:
      result.decision
  });

  createOutcome({
    outcomeType:
      "evaluation_completed",

    source:
      "evaluate_api",

    confidence:
      1.0,

    identityId:
      identity.id,

    sessionId:
      validation.data.sessionId,

    correlationId:
      validation.data.correlationId
  });

  return {
    tenantId:
      tenant.tenantId,

    tenantName:
      tenant.name,

    identityId:
      identity.id,

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
}
