import {
  getOutcomeById
} from "./outcomeRepository.js";

import {
  getIdentityById
} from "./identityRepository.js";

import {
  getSession
} from "./sessionRepository.js";

import {
  getEventsBySession
} from "./eventRepository.js";

export function replayOutcome(
  outcomeId
) {
  const outcome =
    getOutcomeById(outcomeId);

  if (!outcome) {
    return null;
  }

  const identity =
    outcome.identityId
      ? getIdentityById(
          outcome.identityId
        )
      : null;

  const session =
    outcome.sessionId
      ? getSession(
          outcome.sessionId
        )
      : null;

  const events =
    outcome.sessionId
      ? getEventsBySession(
          outcome.sessionId
        )
      : [];

  return {
    outcome,
    identity,
    session,
    events,
    correlationContext: {
      correlationId:
        outcome.correlationId
    }
  };
}
