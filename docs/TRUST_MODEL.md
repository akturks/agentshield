# AgentShield Trust Model

## Core Insight

Trust is not computed directly from events.

Trust is computed from behavioral signals derived from events.

Flow:

Identity
↓
Memory (Events)
↓
Signals
↓
Trust
↓
Decision

---

## Why Signals Matter

Events are raw observations.

Examples:

* /admin
* /login
* /wp-admin
* /.env

Events alone are not intelligence.

Signals are intelligence.

Examples:

* admin_scanning
* credential_stuffing
* automated_enumeration
* suspicious_automation

---

## Signal Layer

The Signal Layer transforms event history into behavioral indicators.

Example:

Events:

/admin
/wp-admin
/.env

↓

Signal:

admin_scanning

---

Events:

/login
/login
/login
/login

↓

Signal:

credential_stuffing

---

Events:

20 requests
2 seconds
20 unique paths

↓

Signal:

automated_enumeration

---

## Trust Layer

Trust is computed from signals.

Not from individual requests.

Example:

Signals:

* admin_scanning
* multiple_blocks

↓

Trust Score = 32

---

## Explainability

Customers should not only see a score.

Customers should understand why.

Bad:

Trust = 32

Good:

Trust = 32

Signals:

* admin_scanning
* multiple_blocks

---

## Long-Term Architecture

Identity
↓
Memory
↓
Signals
↓
Trust
↓
Decision

AgentShield does not evaluate requests.

AgentShield evaluates entities through behavioral intelligence.

---

## Product Thesis

Most security products generate alerts.

AgentShield generates trust.

Most security products evaluate actions.

AgentShield evaluates entities.
