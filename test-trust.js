import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import {
  calculateTrust
} from "./repositories/trustRepository.js";

const identity = findOrCreateIdentity({
  tenantId: "tenant_1",
  fingerprint: "curl/8.0"
});

const trust = calculateTrust(identity.id);

console.log(trust);
