import {
  getModelVersions
} from "./modelVersionRepository.js";

export function buildTrustRepresentation(
  trustAssessment
) {
  const now =
    new Date();

  const expiresAt =
    new Date(
      now.getTime() +
      24 * 60 * 60 * 1000
    );

  const modelVersions =
    getModelVersions();

  return {
    identityReference:
      trustAssessment.identityReference,

    trustScore:
      trustAssessment.trustScore,

    trustDimensions:
      trustAssessment.trustDimensions,

    confidence:
      trustAssessment.confidence,

    intentAssessment:
      trustAssessment.intentAssessment,

    issuedAt:
      now.toISOString(),

    expiresAt:
      expiresAt.toISOString(),

    modelVersions
  };
}
