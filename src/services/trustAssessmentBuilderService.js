import {
  calculateConfidence
} from "./confidenceCalculationService.js";

import {
  calculateTrustDimensions
} from "./trustDimensionsService.js";

import {
  getModelVersions
} from "../../repositories/modelVersionRepository.js";

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

  const modelVersions =
    getModelVersions();

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

    modelVersions
  };
}
