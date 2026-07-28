# AgentShield

> **This document describes the private API, which is not the active work.** The
> live system is the observatory in `public-site/`. Start from `CLAUDE.md` at the
> root, then `public-site/README.md`. The continuation prompt near the bottom of
> this file names a phase that ended; it is kept as history, not as an instruction.

IMPORTANT

This repository contains canonical architectural documents.

Before proposing any implementation or architectural changes, read:

docs/ONTOLOGY.md
docs/CONSTITUTION.md
docs/ENGINEERING_GUIDE.md
docs/PROJECT_CONTEXT.md

These documents are authoritative.

If any older document, conversation, implementation detail or proposal conflicts with them:

The canonical documents win.

Do not begin implementation planning until these documents have been read.






# AgentShield

AgentShield preserves replayable reality for digital actors.

## Current Status

### Architecture

* Reality Constitution v1
* Replay Infrastructure v0.3
* Identity Memory
* Session Tracking
* Outcome Tracking
* Correlation Contexts

### Replay Endpoints

#### Outcome Replay

```bash
GET /v1/replay/outcome/:outcomeId
```

#### Session Replay

```bash
GET /v1/replay/session/:sessionId
```

#### Identity Replay

```bash
GET /v1/replay/identity/:identityId
```

#### Timeline Replay

```bash
GET /v1/replay/timeline/:identityId
```

## Local Development

### Install

```bash
pnpm install
```

### Seed Demo Data

```bash
pnpm run seed
```

### Start

```bash
pnpm start
```

Expected:

```text
AgentShield API running on port 3000
```

## Repository Milestones

### Refactor Complete

Tag:

```text
refactor-complete-v1
```

### Reality Constitution

Tag:

```text
reality-constitution-v1
```

### Replay Infrastructure

```text
replay-infrastructure-v0
replay-infrastructure-v0.1
replay-infrastructure-v0.2
replay-infrastructure-v0.3
```

## Core Principle

Store observations.

Version interpretations.

Reproduce reasoning.

 ## Canonical Architecture Documents

Before making architectural or implementation decisions, read:

* docs/ONTOLOGY.md
* docs/CONSTITUTION.md
* docs/ENGINEERING_GUIDE.md
* docs/PROJECT_CONTEXT.md

These documents are canonical.

If implementation, architecture proposals, or historical documentation conflict with these documents:

The canonical documents win.

---

## Continuation Prompt

For new development sessions:

AgentShield continuation.

Read these documents first:

docs/ONTOLOGY.md
docs/CONSTITUTION.md
docs/ENGINEERING_GUIDE.md
docs/PROJECT_CONTEXT.md

These documents are canonical.

Do not propose solutions that violate them.

Current phase:

Replay Infrastructure

Current target:

REPLAY-002
Unified Historical Timeline

After reading the documents, propose an implementation plan.



Documentation Update Rule

Any architectural milestone that changes
the understanding of the system must be
reflected in the canonical documents.

Code may change the system.

Documentation changes the understanding
of the system.

Both are first-class deliverables.
