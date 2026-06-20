# AgentShield Current Ontology v1

Status: Draft

Purpose:

This document represents the current observed ontology of AgentShield based on:

* Current implementation
* Repository structure
* Active services
* Active repositories
* Architectural decisions
* Technical debt register

This document takes precedence over historical interpretations until superseded.

---

# Core Principle

Reality is the canonical source of truth.

History preserves reality.

Discovery derives observations from history.

Knowledge is promoted from validated hypotheses.

Trust is computed from evidence.

Risk is derived from trust.

---

# Shared Reality Layer

Reality Objects:

* Event
* Session
* Identity
* Outcome

Repositories:

* eventRepository
* sessionRepository
* identityRepository
* outcomeRepository

Status:

Implemented

---

# History Domain

Purpose:

Preserve behavioral history and replayability.

Components:

* Behavior History
* Replay Infrastructure
* Timeline

Repositories:

* behaviorHistoryRepository
* replayRepository

Status:

Implemented

Notes:

Replay remains an active area of development.

---

# Discovery Domain

Purpose:

Identify behavioral patterns from historical evidence.

Components:

* Pattern Discovery
* Population Archive Builder
* Population Discovery
* Correlation

Services:

* patternDiscoveryService
* populationArchiveBuilderService
* populationDiscoveryService
* correlationEngineService
* discoveryService

Status:

Foundation

---

# Characterization Domain

Purpose:

Transform behavioral evidence into behavioral characterizations.

Current Profiles:

* Observer
* Explorer
* Researcher

Services:

* characterizationService

Status:

Foundation

---

# Hypothesis Domain

Purpose:

Generate and validate explanations derived from discoveries.

Components:

* Hypothesis Generation
* Evidence Collection
* Validation

Services:

* hypothesisGenerationService
* hypothesisEvidenceService
* hypothesisValidationService

Status:

Foundation

---

# Knowledge Domain

Purpose:

Promote validated hypotheses into accepted knowledge.

Components:

* Knowledge Promotion

Services:

* knowledgePromotionService

Status:

Foundation

Future Components:

* Knowledge Archive
* Knowledge Replay
* Knowledge Evolution

Current State:

Not yet implemented beyond promotion.

---

# Observation Domain

Purpose:

Generate human-readable observations from knowledge and behavioral evidence.

Services:

* observationGenerationService

Status:

Foundation

---

# Trust Domain

Purpose:

Assess trust and derive policy decisions.

Components:

* Trust Assessment
* Trust Representation
* Confidence
* Trust Update

Status:

Implemented

---

# Enforcement Domain

Purpose:

Transform trust assessments into actions.

Components:

* Policy Engine
* Enforcement Engine

Status:

Implemented

---

# Learning Domain

Purpose:

Generate learning signals from outcomes and characterizations.

Services:

* learningEngineService
* feedbackEngineService

Status:

Experimental Foundation

Notes:

Learning currently generates signals.

Learning does not yet modify memory, knowledge, trust or characterization.

---

# Current High-Level Structure

Reality
→ History
→ Discovery
→ Characterization
→ Hypothesis
→ Knowledge
→ Observation

Reality
→ Identity
→ Trust
→ Decision
→ Outcome

---

# Architectural Status

Current Ontology Version:

v1

Generated During:

Ontology Synchronization Initiative

Status:

Living Document

