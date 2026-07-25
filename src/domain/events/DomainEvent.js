import { randomUUID } from "crypto";

export class DomainEvent {
  constructor({
    eventId = randomUUID(),
    eventType,
    aggregateId,
    timestamp = new Date().toISOString(),
    payload = {},
    metadata = {}
  }) {
    this.eventId = eventId;
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.timestamp = timestamp;
    this.payload = payload;
    this.metadata = metadata;

    this.validate();
  }

  validate() {
    if (!this.eventType) {
      throw new Error("eventType is required");
    }

    if (!this.aggregateId) {
      throw new Error("aggregateId is required");
    }
  }

  toJSON() {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      timestamp: this.timestamp,
      payload: this.payload,
      metadata: this.metadata
    };
  }
}
