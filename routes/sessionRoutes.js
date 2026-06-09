import {
  getEventsBySession,
  getSessionProfile
} from "../repositories/eventRepository.js";

import {
  getOutcomesBySession
} from "../repositories/outcomeRepository.js";

export default async function (
  app,
  {
    TENANTS
  }
) {

  app.get(
    "/v1/sessions/:sessionId",
    async (request) => {

      const events =
        getEventsBySession(
          request.params.sessionId
        );

      return {
        sessionId:
          request.params.sessionId,

        events
      };
    }
  );

  app.get(
    "/v1/sessions/:sessionId/outcomes",
    async (request) => {

      const outcomes =
        getOutcomesBySession(
          request.params.sessionId
        );

      return {
        sessionId:
          request.params.sessionId,

        outcomeCount:
          outcomes.length,

        outcomes
      };
    }
  );

  app.get(
    "/v1/sessions/:sessionId/profile",
    async (request, reply) => {

      const profile =
        getSessionProfile(
          request.params.sessionId
        );

      if (!profile) {
        return reply
          .status(404)
          .send({
            error:
              "session_not_found"
          });
      }

      const tenant =
        TENANTS["test_key_123"];

      let estimatedValue = 0;

      if (
        profile.trafficTier ===
        "low"
      ) {
        estimatedValue =
          tenant.lowTrafficValue;
      }

      if (
        profile.trafficTier ===
        "medium"
      ) {
        estimatedValue =
          tenant.mediumTrafficValue;
      }

      if (
        profile.trafficTier ===
        "high"
      ) {
        estimatedValue =
          tenant.highTrafficValue;
      }

      return {
        ...profile,
        estimatedValue
      };
    }
  );
}
