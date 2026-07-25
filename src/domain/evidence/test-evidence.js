import { Evidence }
  from "./Evidence.js";

import {
  EvidenceVerificationEvent
}
from "./EvidenceVerificationEvent.js";

const evidence =
  new Evidence({

    evidenceType:
      "human-label",

    source:
      "manual-review",

    payload: {
      label:
        "known-human"
    }
  });

console.log(
  "INITIAL:",
  evidence.currentVerificationStatus
);

const event =
  new EvidenceVerificationEvent({

    evidenceId:
      evidence.evidenceId,

    previousStatus:
      "created",

    newStatus:
      "verified",

    actor: {
      type:
        "human",

      id:
        "reviewer-001"
    },

    reason:
      "Manual verification"
  });

evidence.applyEvent(event);

console.log(
  "AFTER EVENT:",
  evidence.currentVerificationStatus
);
