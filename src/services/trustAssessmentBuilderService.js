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
  intent,
  observedEventCount
}) {
  const confidence =
    calculateConfidence({
      signals,
      evidence
    });

  // How much was observed of this identity — not how much of it we filed as
  // evidence.
  //
  // This used to count the entries in `evidence`, which coupled two unrelated
  // things: `calculateTrustDimensions` reads the number as activity history
  // (`50 + eventCount * 5`), so improving our own record-keeping raised the
  // identity's operational and reputation trust. Worse, while only
  // `admin_scanning` produced any evidence, the sole way to score above the
  // baseline here was to have been caught scanning `/admin` — an identity with
  // fourteen ordinary events and three positive signals sat at 50 while one with
  // four admin probes reached 70. Admin scanning is already accounted for, at
  // -70 on securityTrust.
  //
  // Falls back to the old derivation when the caller does not supply the count,
  // so an existing caller keeps working rather than silently scoring everything
  // at the baseline.
  const eventCount =
    typeof observedEventCount === "number"
      ? observedEventCount
      : Object.values(evidence)
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
