import {
  getEventsBySession,
  getSessionProfile
} from "../repositories/eventRepository.js";

import {
  getOutcomesBySession
} from "../repositories/outcomeRepository.js";

export default async function (
  app
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

let estimatedValue = 0;

if (
  profile.trafficTier ===
  "low"
) {
  estimatedValue = 5;
}

if (
  profile.trafficTier ===
  "medium"
) {
  estimatedValue = 25;
}

if (
  profile.trafficTier ===
  "high"
) {
  estimatedValue = 100;
}

      return {
        ...profile,
        estimatedValue
      };
    }
  );
}
