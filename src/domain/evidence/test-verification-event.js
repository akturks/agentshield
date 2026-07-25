import { EvidenceVerificationEvent }
  from "./EvidenceVerificationEvent.js";

const event =
  new EvidenceVerificationEvent({

    evidenceId:
      "evidence-123",

    previousStatus:
      "created",

    newStatus:
      "verified",

actor: {
  type: "human",
  id: "manual-reviewer"
},

    reason:
      "Manual review completed"
  });

console.log(
  JSON.stringify(
    event.toJSON(),
    null,
    2
  )
);
