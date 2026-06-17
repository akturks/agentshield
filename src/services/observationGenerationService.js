import { getAllEvents } from "../../repositories/eventRepository.js";

export function generateObservations() {
  const events = getAllEvents();

  const observations = [];

  if (events.length === 0) {
    return observations;
  }

  const pageViews = events.filter(
    event => event.eventType === "page_view"
  );

  if (pageViews.length > 20) {
    observations.push({
      type: "traffic",
      title: "Sustained Activity Detected",
      observation:
        `Observed ${pageViews.length} page views during the observation period.`,
      confidence: 0.7
    });
  }

  const referrerEvents = events.filter(
    event => event.referrer
  );

  if (referrerEvents.length > 0) {
    observations.push({
      type: "traffic_source",
      title: "External Referrer Activity",
      observation:
        `${referrerEvents.length} events originated from external referrers.`,
      confidence: 0.6
    });
  }

  return observations;
}
