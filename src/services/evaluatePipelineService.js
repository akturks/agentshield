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
  saveEventAssessment,
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

  console.log("TRUST_DEBUG", trust);

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

      intent,

      observedEventCount:
        trust.eventCount
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
    signals:
       trustAssessment.signals,

    evidence:
       trustAssessment.evidence,

    // buildTrustAssessment already resolves both of these; they were computed
    // and then dropped on the floor here, which is why no stored assessment
    // could be replayed against the method that produced it.
    modelVersions:
       trustAssessment.modelVersions,

    observedEventCount:
       trust.eventCount,

    assessmentTimestamp:
      trustAssessment
        .assessmentTimestamp
  });

  const trustRepresentation =
    buildTrustRepresentation(
      trustAssessment
    );


  // The observation goes in first and carries nothing that was concluded about
  // it. riskScore and decision used to be passed here, into the same row as the
  // path and the user agent that produced them, which left no way to revisit the
  // verdict without the evidence for it having been overwritten by the verdict.
  const event =
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

    mouseMoves:
      validation.data.mouseMoves,

    scrollDepth:
      validation.data.scrollDepth,

    clickCount:
      validation.data.clickCount,

    focusEvents:
      validation.data.focusEvents,

    readingTime:
      validation.data.readingTime,

    deviceFingerprint:
      validation.data.deviceFingerprint,

    challengeResult:
      validation.data.challengeResult
  });

  // And the conclusion goes beside it, in its own row, with the reasons it was
  // built from and the version of the rule that built it. Both inputs the score
  // reads — path and user agent — are on the event above, so this pair can be
  // recomputed; the previous arrangement stored the answer and lost the question.
  saveEventAssessment({
    eventId:
      event.id,

    riskScore:
      result.score,

    decision:
      result.decision,

    reasons:
      result.reasons,

    methodVersion:
      result.methodVersion
  });

createOutcome({
  outcomeType:
    policyDecision.toUpperCase(),

  source:
    "policy_engine",

  confidence:
    trustAssessment.confidence,

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
