import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

const identity = findOrCreateIdentity({
  tenantId: "tenant_1",
  fingerprint: "curl/8.0"
});

console.log(identity);
