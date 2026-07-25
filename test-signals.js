import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import db from "./repositories/db.js";

import {
  deriveSignals
} from "./src/services/signalDerivationService.js";

const identity = findOrCreateIdentity({
  tenantId: "tenant_1",
  fingerprint: "curl/8.0"
});

const events = db.prepare(`
  SELECT *
  FROM Event
  WHERE identityId = ?
`).all(identity.id);

const signals =
  deriveSignals(events);

console.log(signals);
