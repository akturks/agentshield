import { Evidence }
  from "../domain/evidence/Evidence.js";

import {
  EvidenceVerificationEvent
}
from "../domain/evidence/EvidenceVerificationEvent.js";

import {
  EvidenceRepository
}
from "./EvidenceRepository.js";

const repository =
  new EvidenceRepository();

const evidence =
  new Evidence({

    evidenceType:
      "human-label",

    source:
      "manual-review"
  });

repository.saveEvidence(
  evidence
);

const verifiedEvent =
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

repository.appendEvent(
  evidence.evidenceId,
  verifiedEvent
);

const replayed =
  repository.reconstructEvidence(
    evidence.evidenceId
  );

console.log(
  replayed.currentVerificationStatus
);
