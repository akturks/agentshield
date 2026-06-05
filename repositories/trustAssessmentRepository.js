import {
  calculateConfidence
} from "./confidenceRepository.js";

import {
  calculateTrustDimensions
} from "./trustDimensionsRepository.js";

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

  const eventCount =
    Object.values(evidence)
      .flat()
      .length;

  const trustDimensions =
    calculateTrustDimensions({
      signals,
      eventCount
    });

  return {
    identityReference:
      identityId,

    trustScore,

    trustDimensions,

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
