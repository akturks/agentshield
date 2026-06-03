import {
  findOrCreateIdentity
} from "./repositories/identityRepository.js";

import {
  createEvent,
  getEventsByIdentity
} from "./repositories/eventRepository.js";

const identity = findOrCreateIdentity({
  tenantId: "tenant_1",
  fingerprint: "curl/8.0"
});

createEvent({
  identityId: identity.id,
  eventType: "request",
  path: "/admin",
  userAgent: "curl/8.0",
  riskScore: 70,
  decision: "block"
});

const events =
  getEventsByIdentity(identity.id);

console.log(events);
