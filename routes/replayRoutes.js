import {
  replayOutcome
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
}
