import {
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

import {
  getAllEvents
} from "../repositories/eventRepository.js";

import {
  getAllOutcomes
} from "../repositories/outcomeRepository.js";

import {
  classify
} from "../src/services/riskClassificationService.js";

export default async function (
  app
) {

  app.get(
    "/v1/dashboard",
    async () => {

      const identities =
        getAllIdentityProfiles();

      const events =
        getAllEvents();

      const outcomes =
        getAllOutcomes();

      const highRiskIdentities =
        identities.filter(
          profile =>
            classify(profile)
              .riskLevel === "high" ||
            classify(profile)
              .riskLevel === "critical"
        );

      const averageTrustScore =
        identities.length > 0
          ? Math.round(
              identities.reduce(
                (sum, profile) =>
                  sum +
                  profile.currentTrustScore,
                0
              ) /
                identities.length
            )
          : 0;

      const latestOutcome =
        outcomes.length > 0
          ? outcomes[0].outcomeType
          : null;

      const latestCorrelationId =
        outcomes.length > 0
          ? outcomes[0].correlationId
          : null;

      let health =
        "healthy";

      if (
        highRiskIdentities.length > 0
      ) {
        health =
          "warning";
      }

      return {
        health,
        identities:
          identities.length,
        events:
          events.length,
        outcomes:
          outcomes.length,
        highRiskIdentities:
          highRiskIdentities.length,
        averageTrustScore,
        latestOutcome,
        latestCorrelationId
      };
    }
  );
}
