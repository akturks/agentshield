# Traffic Quality Model Roadmap

## Current Version (v2)

Traffic quality is currently assigned using behavior categories.

Current mapping:

* bounce → 20
* exploration → 60
* engaged → 90

This implementation is intentionally heuristic and serves as a bootstrap model.

---

## Planned Version (v3)

Traffic quality should be derived from evidence rather than behavior labels.

Concept:

TrafficQuality = f(
eventCount,
sessionDepth,
referrerQuality,
trustScore,
riskScore,
conversionSignals
)

---

## Evidence-Based Scoring

Base Score = 50

Evidence adjustments:

* single_page_visit → -20
* external_referrer → +10
* multi_page_navigation → +20
* high_session_depth → +30

---

## Future Signals

Additional scoring inputs:

* trustScore
* riskScore
* conversion events
* economic impact
* tenant-specific weights

---

## Design Goals

Traffic quality should be:

* explainable
* evidence-driven
* tenant-configurable
* economically meaningful

---

## Long-Term Pipeline

Event
↓
Session
↓
Behavior
↓
Intent
↓
Evidence
↓
Traffic Quality
↓
Economic Impact

