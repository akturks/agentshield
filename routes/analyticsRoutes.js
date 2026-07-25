import {
  getAllEvents
} from "../repositories/eventRepository.js";

import {
  getAllIdentityProfiles
} from "../repositories/assessmentRepository.js";

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

      const events =
        getAllEvents();

      const totalEvents =
        events.length;

      const blockedEvents =
        events.filter(
          event =>
            event.decision ===
            "block"
        ).length;

      const allowedEvents =
        events.filter(
          event =>
            event.decision ===
            "allow"
        ).length;

      const averageRisk =
        totalEvents > 0
          ? events.reduce(
              (sum, event) =>
                sum +
                (event.riskScore || 0),
              0
            ) / totalEvents
          : 0;

      const blockRate =
        totalEvents > 0
          ? (
              blockedEvents /
              totalEvents
            ) * 100
          : 0;

      return {
        totalEvents,
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
