import { DomainEvent }
  from "../events/DomainEvent.js";

const VALID_STATUSES = [
  "created",
  "verified",
  "disputed",
  "retracted"
];

const VALID_ACTOR_TYPES = [
  "human",
  "system",
  "external"
];

export class EvidenceVerificationEvent
  extends DomainEvent {

  constructor({
    evidenceId,
    previousStatus,
    newStatus,
    actor,
    reason = ""
  }) {

    super({
      eventType:
        "evidence.verification",

      aggregateId:
        evidenceId,

      payload: {
        previousStatus,
        newStatus,
        actor,
        reason
      }
    });

    this.validateVerification(
      previousStatus,
      newStatus,
      actor
    );
  }

  validateVerification(
    previousStatus,
    newStatus,
    actor
  ) {

    if (
      !VALID_STATUSES.includes(
        previousStatus
      )
    ) {
      throw new Error(
        "Invalid previousStatus"
      );
    }

    if (
      !VALID_STATUSES.includes(
        newStatus
      )
    ) {
      throw new Error(
        "Invalid newStatus"
      );
    }

    if (
      !VALID_ACTOR_TYPES.includes(
        actor.type
      )
    ) {
      throw new Error(
        "Invalid actor.type"
      );
    }

    //
    // Constitutional Rule
    //

    if (
      newStatus === "verified" &&
      actor.type === "system"
    ) {
      throw new Error(
        "Any transition into Verified state requires a human or external actor"
      );
    }
  }
}
