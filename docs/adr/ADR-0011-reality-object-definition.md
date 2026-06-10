# ADR-0011: Reality Object Definition

Status: Accepted

Date: 2026-06-09

---

## Context

AgentShield preserves replayable reality for digital actors.

As the platform evolves, it becomes increasingly important to distinguish:

- Observed reality
- Interpretations of reality

Failure to maintain this boundary leads to ontology drift, where conclusions become indistinguishable from observations.

This weakens replayability and prevents future models from reinterpreting historical reality.

---

## Decision

AgentShield separates Reality Objects from Interpretation Objects.

### Reality Objects

Reality Objects represent observed events or consequences.

Reality Objects may be stored in the Reality Archive.

Examples:

- Event
- Outcome
- Assessment

Examples of valid Outcomes:

- purchase_completed
- account_created
- email_verified
- chargeback_received
- login_succeeded
- login_failed

Reality Objects answer:

> What happened?

---

### Interpretation Objects

Interpretation Objects represent conclusions derived from reality.

Interpretation Objects may change as models improve.

Examples:

- Trust
- Risk
- Reputation
- Intent
- Memory

Examples:

- known_bot
- trusted_customer
- fraudster
- high_value_user
- suspicious_actor

Interpretation Objects answer:

> What does it mean?

---

## Rule

Interpretations MUST NOT be stored as Outcomes.

Invalid:

Outcome:
known_bot

Outcome:
trusted_customer

Outcome:
fraudster

Valid:

Outcome:
chargeback_received

Trust Assessment:
high_risk

---

## Rationale

Reality should remain stable.

Interpretations should remain replaceable.

Future models must be able to replay historical reality and derive new conclusions without modifying archived observations.

---

## Consequences

AgentShield stores:

Observed Reality

and computes:

Trust
Risk
Intent
Reputation
Memory

from that reality.

Replayability depends on preserving this boundary.

---

## Core Principle

Reality is the canonical source of truth.

Interpretation is replaceable.

Replayability depends on preserving the distinction.
