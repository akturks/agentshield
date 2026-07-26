import {
  getAllEvents
} from "../repositories/eventRepository.js";

import {
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

import {
  verdictTotals
} from "../repositories/eventAssessmentRepository.js";

export default async function (
  app,
  {
    classify,
    evaluatePolicy,
    allocate,
    enforce
  }
) {

  app.get(
    "/v1/events",
    async () => {

      const events =
        getAllEvents();

      return {
        events
      };
    }
  );

  app.get(
    "/v1/traffic-quality",
    async () => {

      // Observations and verdicts are counted separately because they are
      // separate records now, and the difference is worth reporting: an event
      // with no assessment is one this endpoint must not describe either way.
      const totalEvents =
        getAllEvents().length;

      const totals =
        verdictTotals();

      const assessedEvents =
        totals.assessed || 0;

      const blockedEvents =
        totals.blocked || 0;

      const allowedEvents =
        totals.allowed || 0;

      const averageRisk =
        assessedEvents > 0
          ? totals.averageRisk
          : 0;

      const blockRate =
        assessedEvents > 0
          ? (
              blockedEvents /
              assessedEvents
            ) * 100
          : 0;

      return {
        totalEvents,
        assessedEvents,
        blockedEvents,
        allowedEvents,
        blockRate,
        averageRisk
      };
    }
  );

  app.get(
    "/v1/risk-queue",
    async () => {

      const identities =
        getAllIdentityProfiles();

      const queue =
        identities.map(
          profile => {

            const risk =
              classify(profile);

            const policy =
              evaluatePolicy(risk);

            const allocation =
              allocate(risk);

            const enforcement =
              enforce(
                policy,
                allocation
              );

            let priority =
              "normal";

            if (
              risk.riskLevel ===
              "critical"
            ) {
              priority =
                "urgent";
            } else if (
              risk.riskLevel ===
              "high"
            ) {
              priority =
                "high";
            }

            return {
              identityId:
                profile.identityId,

              trustScore:
                profile.currentTrustScore,

              riskScore:
                risk.riskScore,

              riskLevel:
                risk.riskLevel,

              priority,

              policy,

              allocation,

              enforcement
            };
          }
        );

      return {
        queue
      };
    }
  );
}
