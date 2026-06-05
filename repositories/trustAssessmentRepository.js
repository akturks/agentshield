import {
  calculateConfidence
} from "./confidenceRepository.js";

export function buildTrustAssessment({
  identityId,
  trustScore,
  signals,
  evidence,
  intent
}) {
  const confidence =
    calculateConfidence({
      signals,
      evidence
    });

  return {
    identityReference:
      identityId,

    trustScore,

    confidence,

    signals,

    evidence,

    intentAssessment: {
      intent,
      confidence
    },

    assessmentTimestamp:
      new Date().toISOString(),

    trustModelVersion:
      "1.0"
  };
}
