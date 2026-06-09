import {
  createOutcome,
  getAllOutcomes,
  getOutcomesByIdentity,
  getOutcomesByCorrelationId
} from "../repositories/outcomeRepository.js";

export default async function (
  app,
  {
    OutcomeSchema
  }
) {

  app.get(
    "/v1/correlations/:correlationId",
    async (request) => {

      const outcomes =
        getOutcomesByCorrelationId(
          request.params.correlationId
        );

      return {
        correlationId:
          request.params.correlationId,

        outcomeCount:
          outcomes.length,

        outcomes
      };
    }
  );

  app.post(
    "/v1/outcomes",
    async (request, reply) => {

      const validation =
        OutcomeSchema.safeParse(
          request.body || {}
        );

      if (!validation.success) {
        return reply.status(400).send({
          error: "validation_failed",
          details:
            validation.error.issues
        });
      }

      const outcome =
        createOutcome({
          outcomeType:
            validation.data.outcomeType,

          source:
            validation.data.source,

          confidence:
            validation.data.confidence ??
            1.0,

          identityId:
            validation.data.identityId,

          sessionId:
            validation.data.sessionId,

          correlationId:
            validation.data.correlationId
        });

      return {
        status: "recorded",
        outcome
      };
    }
  );

  app.get(
    "/v1/identities/:identityId/outcomes",
    async (request) => {

      const outcomes =
        getOutcomesByIdentity(
          request.params.identityId
        );

      return {
        identityId:
          request.params.identityId,

        outcomeCount:
          outcomes.length,

        outcomes
      };
    }
  );

  app.get(
    "/v1/outcomes",
    async () => {

      const outcomes =
        getAllOutcomes();

      return {
        outcomeCount:
          outcomes.length,

        outcomes
      };
    }
  );
}
