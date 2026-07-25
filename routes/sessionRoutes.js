import {
  getEventsBySession
} from "../repositories/eventRepository.js";

import {
  getOutcomesBySession
} from "../repositories/outcomeRepository.js";

import {
  buildSessionProfile
} from "../src/services/sessionProfileService.js";

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
        buildSessionProfile(
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

      return profile;
    }
  );
}
