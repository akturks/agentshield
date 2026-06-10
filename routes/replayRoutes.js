import {
  replayOutcome,
  replaySession,
  replayIdentity,
  replayTimeline
} from "../repositories/replayRepository.js";

export default async function (
  app
) {

  app.get(
    "/v1/replay/outcome/:outcomeId",
    async (request, reply) => {

      const replay =
        replayOutcome(
          request.params.outcomeId
        );

      if (!replay) {
        return reply
          .status(404)
          .send({
            error:
              "outcome_not_found"
          });
      }

      return replay;
    }
  );

  app.get(
    "/v1/replay/session/:sessionId",
    async (request, reply) => {

      const replay =
        replaySession(
          request.params.sessionId
        );

      if (!replay) {
        return reply
          .status(404)
          .send({
            error:
              "session_not_found"
          });
      }

      return replay;
    }
  );

  app.get(
    "/v1/replay/identity/:identityId",
    async (request, reply) => {

      const replay =
        replayIdentity(
          request.params.identityId
        );

      if (!replay) {
        return reply
          .status(404)
          .send({
            error:
              "identity_not_found"
          });
      }

      return replay;
    }
  );

  app.get(
    "/v1/replay/timeline/:identityId",
    async (request, reply) => {

      const replay =
        replayTimeline(
          request.params.identityId
        );

      if (!replay) {
        return reply
          .status(404)
          .send({
            error:
              "identity_not_found"
          });
      }

      return replay;
    }
  );
}
