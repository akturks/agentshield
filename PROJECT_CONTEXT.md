# AgentShield Bootstrap Context

## Current Vision

AgentShield is an Internet Trust Protocol.

Core Flow:

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

AgentShield evaluates identities, not requests.

---

## Architecture

Tenant
├─ ApiKey
└─ Identity
└─ Event

Identity = Who

Event = What happened

Signals = Behavioral patterns derived from events

Intent = What the entity is trying to do

Trust = Computed from behavioral signals

Decision = allow / challenge / block

---

## Current Technical Decisions

Prisma:

* Used for schema management
* Used for migrations

Runtime:

* better-sqlite3

Reason:

* Prisma 7 runtime issues in current environment

---

## Current Database

SQLite

Tables:

* Tenant
* ApiKey
* Identity
* Event

---

## Current Progress

Completed:

* API Foundation
* Rule Engine
* Reasons Engine
* Validation Layer
* API Key Authentication
* Tenant Resolution
* Database Foundation
* Architecture Blueprint
* Identity Foundation
* Identity Repository
* Event Repository
* Memory Layer
* Trust Engine v1
* Signal Engine v1

Working:

* Trust Engine v2 (Signals → Trust)

Next:

* Intent Engine v1
* Decision Policy v1
* Trust integration in evaluate endpoint
* Signal integration in evaluate endpoint

---

## Current Checkpoint

Latest successful tests:

* Identity creation works
* Event recording works
* Trust Engine v1 works
* Signal Engine v1 works

Example:

Signals:

* admin_scanning

Trust:
0

Event Count:
3

---

## Immediate Next Task

Refactor Trust Engine to use Signals.

Goal:

Identity
↓
Memory
↓
Signals
↓
Trust



