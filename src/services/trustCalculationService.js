import {
  getEventsByIdentity
} from "../../repositories/eventRepository.js";

import {
  deriveSignals
} from "./signalDerivationService.js";

import {
  deriveEvidence
} from "./evidenceDerivationService.js";

export function calculateTrust(identityId) {
  const events =
    getEventsByIdentity(identityId);

  const signals =
    deriveSignals(events);

  const evidence =
    deriveEvidence(events);

  let trustScore = 50;

  if (
    signals.includes(
      "admin_scanning"
    )
  ) {
    trustScore -= 20;
  }

  if (
    signals.includes(
      "engaged_reading"
    )
  ) {
    trustScore += 5;
  }

  if (
    signals.includes(
      "deep_scroll"
    )
  ) {
    trustScore += 5;
  }

  if (
    signals.includes(
      "active_mouse"
    )
  ) {
    trustScore += 2;
  }

  if (
    signals.includes(
      "focused_session"
    )
  ) {
    trustScore += 2;
  }

  trustScore = Math.max(
    0,
    Math.min(100, trustScore)
  );

  return {
    trustScore,
    signals,
    evidence,
    eventCount: events.length
  };
}
