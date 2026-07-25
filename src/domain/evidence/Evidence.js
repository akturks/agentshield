import { randomUUID } from "crypto";

import {
  EVIDENCE_TYPES
} from "./EvidenceType.js";

export class Evidence {
  constructor({
    evidenceId = randomUUID(),
    evidenceType,
    source,
    timestamp = new Date().toISOString(),
    payload = {},
    metadata = {}
  }) {

    this.evidenceId = evidenceId;
    this.evidenceType = evidenceType;
    this.source = source;
    this.timestamp = timestamp;
    this.payload = payload;
    this.metadata = metadata;

    //
    // Current State
    //

    this.currentVerificationStatus =
      "created";

    //
    // History
    //

    this.events = [];

    this.validate();
  }

  validate() {

    if (!this.evidenceType) {
      throw new Error(
        "evidenceType is required"
      );
    }

    if (
  !Object.values(
    EVIDENCE_TYPES
  ).includes(
    this.evidenceType
  )
) {
  throw new Error(
    "Invalid evidenceType"
  );
}

    if (!this.source) {
      throw new Error(
        "source is required"
      );
    }
  }

  applyEvent(event) {

    const status =
      event.payload.newStatus;

    this.currentVerificationStatus =
      status;

    this.events.push(event);
  }

replay(events) {

  this.currentVerificationStatus =
    "created";

  this.events = [];

  for (const event of events) {
    this.applyEvent(event);
  }
}

  toJSON() {

    return {
      evidenceId:
        this.evidenceId,

      evidenceType:
        this.evidenceType,

      source:
        this.source,

      timestamp:
        this.timestamp,

      payload:
        this.payload,

      metadata:
        this.metadata,

      currentVerificationStatus:
        this.currentVerificationStatus
    };
  }
}
