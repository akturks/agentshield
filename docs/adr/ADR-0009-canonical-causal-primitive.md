# ADR-0009: Canonical Causal Primitive

Status: Accepted

Date: 2026-06-10

---

## Context

AgentShield preserves replayable reality for digital actors.

As the platform evolves, it must distinguish between:

- Correlation
- Causation

Reality Archive exists to preserve replayable reality.

Reality Archive is not responsible for encoding explanations.

---

## Decision

The canonical causal primitive of AgentShield is:

Correlation Context

Current implementation:

- correlationId

Future implementations may include:

- Correlation Groups
- Replay Contexts

---

## Rationale

Correlation is an observable property of reality.

Causation is an interpretation of reality.

Reality Archive SHALL preserve:

- what happened
- when it happened
- what happened together

Reality Archive SHALL NOT preserve:

- why it happened
- causal assumptions
- attribution judgments

---

## Examples

Valid:

correlationId=checkout-123

Event:
page_view

Event:
add_to_cart

Outcome:
purchase_completed

Invalid:

page_view caused purchase_completed

---

## Future Systems

Future systems may derive causal interpretations:

- Behavior Graph
- Trust Evolution
- Outcome Learning
- Attribution Engines

These systems MUST derive causality from archived reality.

Archived reality MUST NOT depend on them.

---

## Core Principle

Correlation is archived.

Causality is derived.
