# Reality Collection Governance v1

Status: Proposed Standard v1

Authority: AgentShield Constitution v1

---

# Purpose

Reality Collection Governance defines which historical evidence may enter the Reality Archive.

Its purpose is to ensure that collection remains lawful, proportionate, replay-relevant, and consistent with the AgentShield Constitution.

Reality Collection Governance exists to prevent unnecessary collection, over-collection, and collection of information that is not required for replayability, accountability, security, governance, or lawful operation.

---

# Constitutional Foundations

Reality Collection Governance derives its authority from the AgentShield Constitution.

The following constitutional principles apply:

- The protocol serves people.
- People do not serve the protocol.
- AgentShield stores evidence, not secrets.
- AgentShield remains subordinate to applicable law and lawful human authority.
- Collection must remain proportionate, justified, and lawful.
- Replay restores context.
- Replay does not discover context.

---

# Collection Principles

## Principle 1 — Purpose Before Collection

Collection must be justified before collection occurs.

Every collected field must have a documented purpose.

---

## Principle 2 — Evidence Before Convenience

Data shall not be collected merely because collection is technically possible.

Collection must be supported by a legitimate operational, replay, security, governance, or legal purpose.

---

## Principle 3 — Minimum Necessary Collection

If replayability, accountability, governance, lawful operation, or security do not require a field, the field should not be collected.

If collection is still required, explicit governance justification must be documented.

---

## Principle 4 — Replay Relevance

Replay-relevant evidence receives collection priority over convenience, analytics, marketing, or speculative future use cases.

---

## Principle 5 — Constitutional Consistency

No collection practice may violate the AgentShield Constitution.

---

# Collection Classes

## Class A — Replay Evidence

Definition:

Evidence required to restore historical context.

Examples:

- timestamp
- eventType
- sessionId
- correlationId
- outcomeType
- path
- assessmentTimestamp

Collection Status:

Allowed.

---

## Class B — Identity References

Definition:

References used to preserve continuity without requiring direct identity storage.

Examples:

- hashedIp
- hashedEmail
- hashedUserId
- hashedDeviceId

Collection Status:

Allowed when justified.

Hashing or equivalent protection is preferred whenever feasible.

---

## Class C — Secrets

Definition:

Information whose collection is not required for replayability and creates disproportionate security risk.

Examples:

- passwords
- authentication credentials
- private keys
- access tokens
- payment credentials
- card numbers

Collection Status:

Prohibited unless explicitly required by applicable law and lawful authority.

---

## Class D — Historical Interpretation Records

Definition:

Archived historical interpretations that existed at a specific point in time.

Examples:

- TrustAssessment Record
- IntentAssessment Record
- RiskAssessment Record

Collection Status:

Allowed.

Historical Interpretation Records must remain distinguishable from authoritative evidence.

---

# Replay Purpose Registry

Every collected field must have a documented replay purpose.

Required Registry Fields:

| Field | Replay Purpose | Boundary Dependency | Authority Type | Retention |
|---------|---------|---------|---------|---------|

Example:

| Field | Replay Purpose | Boundary Dependency | Authority Type | Retention |
|---------|---------|---------|---------|---------|
| sessionId | Session Reconstruction | Session Boundary | Evidence | 12 Months |
| correlationId | Correlation Replay | Correlation Boundary | Evidence | 12 Months |
| trustAssessment | Historical Interpretation | None | Interpretation | 12 Months |

---

# Authority Types

## Evidence

Authoritative historical artifacts.

Examples:

- Events
- Outcomes
- Sessions
- Identity References

---

## Interpretation

Historical interpretation records.

Examples:

- Trust Assessments
- Intent Assessments
- Risk Assessments

---

## Runtime Derived

Temporary operational artifacts.

Examples:

- Current Trust Score
- Current Reputation Score
- Current Risk State

Runtime-derived artifacts are not authoritative historical evidence.

---

# Replay Dependency Rule

When introducing a new field, the following question must be answered:

What replay capability breaks if this field is removed?

If no replay capability is affected, collection requires explicit governance justification.

---

# Retention Guidance

Retention policies should remain proportional to purpose.

Recommended categories:

| Category | Example |
|-----------|-----------|
| Short-Term | Raw operational telemetry |
| Medium-Term | Replay Evidence |
| Long-Term | Historical State Records |
| Permanent Exception | Legally required archives |

Specific retention periods must be defined separately by policy.

---

# Constitutional Constraints

## Historical Authority

Authoritative artifacts create history.

Derived artifacts describe history.

---

## Evidence Supremacy

Historical evidence remains authoritative.

Interpretations remain reviewable.

---

## Replay Independence

Historical state restoration must never depend on derived interpretations.

Replay must remain possible using authoritative historical evidence.

---

## Secret Exclusion

Secrets must not become replay artifacts.

---

# Governance Review Requirements

New fields require documented answers to the following questions:

1. What purpose requires collection?
2. What replay capability depends on the field?
3. What historical boundary depends on the field?
4. What retention policy applies?
5. Can replay remain complete without the field?
6. If not, why not?
7. Does the field contain or expose secrets?
8. Does collection remain consistent with the AgentShield Constitution?

---

# Governance Maxim

No replay purpose,
no collection.

Collection serves replayable reality.

Replayable reality serves people.
