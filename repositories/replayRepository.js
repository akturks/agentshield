
 import {
  getOutcomeById
} from "./outcomeRepository.js";

import {
  getIdentityById
} from "./identityRepository.js";

import {
  getSession,
  getSessionsByIdentity
} from "./sessionRepository.js";

import {
  getEventsBySession
} from "./eventRepository.js";

import {
  getOutcomesBySession
} from "./outcomeRepository.js";

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

export function replaySession(
  sessionId
) {
  const session =
    getSession(sessionId);

  if (!session) {
    return null;
  }

  const events =
    getEventsBySession(
      sessionId
    );

  const outcomes =
    getOutcomesBySession(
      sessionId
    );

  const correlationContexts =
    [
      ...new Set(
        outcomes
          .map(
            outcome =>
              outcome.correlationId
          )
          .filter(Boolean)
      )
    ];

  return {
    session,
    events,
    outcomes,
    correlationContexts
  };
}

export function replayIdentity(
  identityId
) {
  const identity =
    getIdentityById(
      identityId
    );

  if (!identity) {
    return null;
  }

  const sessions =
    getSessionsByIdentity(
      identityId
    );

  const outcomes = [];

  const events = [];

  for (
    const session of sessions
  ) {

    events.push(
      ...getEventsBySession(
        session.id
      )
    );

    outcomes.push(
      ...getOutcomesBySession(
        session.id
      )
    );
  }

  return {
    identity,
    sessions,
    events,
    outcomes
  };
}
