
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

import {
  getAssessmentsByIdentity
} from "./assessmentRepository.js";

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

const assessments =
  getAssessmentsByIdentity(
    identityId
  );

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
  outcomes,
  assessments
};

}

export function replayTimeline(
  identityId
) {
  const replay =
    replayIdentity(
      identityId
    );

  if (!replay) {
    return null;
  }

  const timeline = [];

  for (
    const event of replay.events
  ) {
    timeline.push({
      type: "event",
      timestamp:
        event.createdAt,
      data: event
    });
  }

  for (
    const assessment of replay.assessments
  ) {
    timeline.push({
      type: "assessment",
      timestamp:
        assessment.assessmentTimestamp,
      data: assessment
    });
  }

  for (
    const outcome of replay.outcomes
  ) {
    timeline.push({
      type: "outcome",
      timestamp:
        outcome.createdAt,
      data: outcome
    });
  }


timeline.sort(
  (a, b) => {

    const aTimestamp =
      a.timestamp
        .replace(" ", "T");

    const bTimestamp =
      b.timestamp
        .replace(" ", "T");

    const aTime =
      Date.parse(
        aTimestamp
      );

    const bTime =
      Date.parse(
        bTimestamp
      );

    if (
      aTime !== bTime
    ) {
      return (
        aTime - bTime
      );
    }

    return a.type.localeCompare(
      b.type
    );
  }
);

  return {
    identity:
      replay.identity,

    timeline
  };
}
