export function buildTrustAssessment({
  identityId,
  trustScore,
  signals,
  evidence,
  intent
}) {
  return {
    identityReference: identityId,

    trustScore,

    signals,

    evidence,

    intentAssessment: {
      intent
    },

    assessmentTimestamp:
      new Date().toISOString(),

    trustModelVersion: "1.0"
  };
}
