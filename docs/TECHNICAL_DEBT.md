# AgentShield Technical Debt Register

This document tracks known architectural, implementation, and design debt.

---

## SESSION-001 — Session Ownership Validation

Priority: Medium

Status: Open

### Problem

A session can be loaded by sessionId without validating ownership.

Current flow:

Identity
→ Session Lookup
→ Event Creation

The system verifies that a session exists but does not verify:

session.identityId == identity.id

### Risk

Potential consequences:

* Session ownership violation
* Event attribution corruption
* Future reputation contamination
* Incorrect behavioral evidence

### Future Solution

When an existing session is loaded:

1. Verify session ownership.
2. If ownership mismatch occurs:

   * reject request, or
   * generate evidence:
     session_identity_mismatch

### Notes

This may become a Trust Engine and Fraud Engine signal.

---

## MEMORY-001 — Memory Runtime Missing

Priority: High

Status: Open

### Problem

Memory model exists in schema but has no runtime implementation.

Current state:

Memory Model
✓

Memory Repository
✗

Memory Service
✗

### Impact

Learning signals are not persisted.

### Target State

Learning
→ Memory Record
→ Identity

---

## TRUST-001 — Outcome Directly Updates Trust

Priority: Medium

Status: Open

### Problem

Current architecture allows:

Outcome
→ Trust Adjustment

### Target Architecture

Outcome
→ Learning
→ Memory
→ Reputation
→ Trust

### Notes

Trust should be influenced by accumulated reputation rather than individual outcomes.

---

## REPUTATION-001 — Reputation Engine Missing

Priority: Medium

Status: Planned

### Problem

Memory records exist conceptually but no reputation layer aggregates them.

### Target State

Memory[]
→ Reputation
→ Trust Assessment

---

## MIGRATION-001 — Schema Drift Risk

Priority: Low

Status: Monitoring

### Problem

Multiple migration drift incidents occurred during development.

### Future Solution

Introduce migration reconciliation and schema governance process.

## OUTCOME-001 — Outcome Pipeline Not Connected To Evaluation Flow

Priority: High

Status: Open

### Problem

The Outcome Engine exists but is not connected to the primary evaluation flow.

Current state:

POST /v1/evaluate

Request
→ Identity
→ Session
→ Trust
→ Intent
→ Policy
→ Enforcement
→ Assessment
→ Event

Outcome generation does not occur.

### Observation

Outcome, Feedback and Learning are currently calculated only in analysis endpoints such as:

GET /v1/identities/:identityId/profile

This means:

* outcome is not generated from real execution events
* learning is not based on actual outcomes
* memory persistence cannot be safely attached

### Impact

Adaptation Engine cannot operate correctly.

The following pipeline is incomplete:

Outcome
→ Learning
→ Memory
→ Reputation

### Future Solution

Introduce explicit Outcome Events.

Example:

Enforcement
→ Outcome Event
→ Learning Signal
→ Memory Record

Outcome generation should occur in the primary evaluation flow rather than read-only analysis endpoints.

### Notes

Memory Runtime implementation depends on resolving this architectural gap.

