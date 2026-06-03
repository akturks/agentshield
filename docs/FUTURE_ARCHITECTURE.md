## Long-Term Architecture

Identity
↓
Memory
↓
Signals
↓
Intent
↓
Trust
↓
Decision Policy
↓
Decision

---

## Layer Responsibilities

Identity

Who is the entity?

---

Memory

What happened historically?

---

Signals

What behavioral patterns are observable?

---

Intent

What is the entity trying to achieve?

Examples:

* Reconnaissance
* Credential Attack
* Automation
* Legitimate Usage

---

Trust

How trustworthy is the entity?

Range:

0-100

---

Decision Policy

Maps Intent + Trust into actions.

Examples:

Intent:
Credential Attack

Trust:
10

↓

Block

---

Intent:
Credential Attack

Trust:
80

↓

Challenge

---

Intent:
Legitimate Usage

Trust:
90

↓

Allow

---

Decision

Final action returned by the system.

* Allow
* Challenge
* Block

---

Core Principle

AgentShield does not evaluate requests.

AgentShield evaluates entities through memory,
behavioral signals, inferred intent and trust.


Entity First Principle

Traditional security systems evaluate requests.

AgentShield evaluates entities.

Requests are temporary.

Entities are persistent.

Trust belongs to entities,
not individual requests.

Explainability Principle

Every Trust score must be explainable.

Every Intent classification must be explainable.

Every Decision must be explainable.

AgentShield should never return:

Trust = 27

It should return:

Trust = 27

Signals:
- admin_scanning
- automated_enumeration

Intent:
Reconnaissance

Identity
↓
Memory
↓
Signals
↓
Intent
↓
Trust
↓
Decision Policy
↓
Decision
