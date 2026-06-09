import {
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

import {
  classify
} from "../src/services/riskClassificationService.js";

export default async function (
  app
) {

  app.get(
    "/v1/high-risk-queue",
    async () => {

      const identities =
        getAllIdentityProfiles();

      const queue =
        identities
          .map(profile => ({
            identityId:
              profile.identityId,

            ...classify(profile)
          }))
          .filter(item =>
            item.riskLevel === "high" ||
            item.riskLevel === "critical"
          )
          .sort(
            (a, b) =>
              b.riskScore -
              a.riskScore
          );

      return {
        queueSize:
          queue.length,

        identities:
          queue
      };
    }
  );
}
