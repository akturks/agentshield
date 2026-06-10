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

