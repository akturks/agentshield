import {
  getAllIdentityProfiles,
  getAssessmentCount
} from "../repositories/assessmentRepository.js";

import {
  getSystemMode
} from "../repositories/systemRepository.js";

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

      const assessments =
        getAssessmentCount();

       const outcomes =
       getAllOutcomes();

       const systemMode =
       getSystemMode(
       "tenant_1"
      );
           
      const outcomeDistribution = {
        ALLOW: 0,
        OBSERVE: 0,
        CHALLENGE: 0,
        THROTTLE: 0
  };

     for (const outcome of outcomes) {

      const type =
      outcome.outcomeType;

  if (
    outcomeDistribution[type]
    !== undefined
  ) {
    outcomeDistribution[type]++;
  }
} 
  
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


      systemMode:
       systemMode
       ?.enforcementMode ??
        "ANALYZE",

        identities:
          identities.length,

        events:
          events.length,

        assessments,

        outcomes:
          outcomes.length,

        highRiskIdentities:
          highRiskIdentities.length,

        averageTrustScore,

        latestOutcome,

        latestCorrelationId,
      
        
        outcomeDistribution    
     };
    }
  );
}
