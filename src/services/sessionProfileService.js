import {
  getEventsBySession
} from "../../repositories/eventRepository.js";

export function buildSessionProfile(
  sessionId
) {
  const events =
    getEventsBySession(sessionId);

  if (events.length === 0) {
    return null;
  }

  let behaviorType =
    "exploration";

  if (events.length === 1) {
    behaviorType =
      "bounce";
  }

  if (events.length > 5) {
    behaviorType =
      "engaged";
  }

  let intent =
    "unknown";

  if (
    behaviorType ===
    "exploration"
  ) {
    intent =
      "research";
  }

  if (
    behaviorType ===
    "engaged"
  ) {
    intent =
      "commercial";
  }

  const evidence = [];

  if (events.length === 1) {
    evidence.push(
      "single_page_visit"
    );
  }

  if (events.length > 1) {
    evidence.push(
      "multi_page_navigation"
    );
  }

  if (events[0].referrer) {
    evidence.push(
      "external_referrer"
    );
  }

  if (
    behaviorType ===
    "engaged"
  ) {
    evidence.push(
      "high_session_depth"
    );
  }

  let trafficQuality = 50;

  if (
    behaviorType ===
    "bounce"
  ) {
    trafficQuality = 20;
  }

  if (
    behaviorType ===
    "exploration"
  ) {
    trafficQuality = 60;
  }

  if (
    behaviorType ===
    "engaged"
  ) {
    trafficQuality = 90;
  }

  let trafficTier =
    "low";

  if (trafficQuality >= 50) {
    trafficTier =
      "medium";
  }

  if (trafficQuality >= 80) {
    trafficTier =
      "high";
  }

  let estimatedValue = 0;

  if (
    trafficTier ===
    "low"
  ) {
    estimatedValue = 5;
  }

  if (
    trafficTier ===
    "medium"
  ) {
    estimatedValue = 25;
  }

  if (
    trafficTier ===
    "high"
  ) {
    estimatedValue = 100;
  }

  return {
    sessionId,
    eventCount: events.length,
    entryPage: events[0].path,
    exitPage:
      events[events.length - 1].path,
    referrer:
      events[0].referrer,

    behaviorType,
    intent,
    evidence,
    trafficQuality,
    trafficTier,
    estimatedValue,

    events
  };
}
