# AgentShield Bootstrap Context

## Current Vision

AgentShield is an Internet Trust Protocol.

Core Flow:

Identity
↓
Memory
↓
Intent
↓
Trust
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

Trust = Computed from historical behavior

Decision = allow / challenge / block

---

## Current Technical Decisions

Prisma:
- Used for schema management
- Used for migrations

Runtime:
- better-sqlite3

Reason:
Prisma 7 runtime issues in current environment.

---

## Current Database

SQLite

Tables:

- Tenant
- ApiKey
- Identity
- Event

---

## Current Progress

Completed:

- API Foundation
- Rule Engine
- Reasons Engine
- Validation Layer
- API Key Authentication
- Tenant Resolution
- Database Foundation
- Architecture Blueprint
- Identity Foundation
- Identity Repository

Working:

- Memory Layer

Next:

- Event Repository
- Event Recording
- Identity integration in evaluate endpoint
- Event integration in evaluate endpoint

---

## Current Checkpoint

Latest successful test:

Identity creation works.

Example:

fingerprint: curl/8.0

identityType: browser

trustScore: 50

tenantId: tenant_1

---

## Immediate Next Task

Build Event Repository.

Goal:

Identity
↓
Event
↓
Memory
↓
Trust
↓
Decision

