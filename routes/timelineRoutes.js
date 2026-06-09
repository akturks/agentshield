import {
  getEventsByIdentity
} from "../repositories/eventRepository.js";

import {
  getOutcomesByIdentity
} from "../repositories/outcomeRepository.js";

export default async function (
  app
) {

  app.get(
    "/v1/identities/:identityId/timeline",
    async (request) => {

      const events =
        getEventsByIdentity(
          request.params.identityId
        );

      const outcomes =
        getOutcomesByIdentity(
          request.params.identityId
        );

      const timeline = [
        ...events.map(event => ({
          type: "event",
          createdAt:
            event.createdAt,
          data: event
        })),

        ...outcomes.map(outcome => ({
          type: "outcome",
          createdAt:
            outcome.createdAt,
          data: outcome
        }))
      ]
        .sort(
          (a, b) =>
            new Date(a.createdAt) -
            new Date(b.createdAt)
        );

      return {
        identityId:
          request.params.identityId,

        itemCount:
          timeline.length,

        timeline
      };
    }
  );
}
