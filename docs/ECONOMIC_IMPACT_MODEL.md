# Economic Impact Model

## Purpose

AgentShield calculates traffic quality.

Customers define business value.

The system must separate behavioral analysis from economic assumptions.

---

## Core Principle

Traffic Quality = AgentShield

Economic Value = Tenant

---

## Traffic Pipeline

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
Traffic Tier
↓
Economic Impact

---

## Traffic Tiers

Traffic Quality Score:

0-49   → low

50-79  → medium

80-100 → high

Example:

trafficQuality = 20

trafficTier = low

---

## Tenant Economic Model

Each tenant defines the value of traffic tiers.

Example:

{
lowTrafficValue: 5,
mediumTrafficValue: 25,
highTrafficValue: 100
}

---

## Economic Impact Calculation

trafficTier = low

estimatedValue = tenant.lowTrafficValue

trafficTier = medium

estimatedValue = tenant.mediumTrafficValue

trafficTier = high

estimatedValue = tenant.highTrafficValue

---

## Example

Session Profile:

{
trafficQuality: 20,
trafficTier: "low"
}

Tenant Configuration:

{
lowTrafficValue: 5,
mediumTrafficValue: 25,
highTrafficValue: 100
}

Result:

{
estimatedValue: 5
}

---

## Future Enhancements

Future versions may support:

* lead value multipliers
* conversion value weighting
* industry-specific models
* tenant-specific quality scoring
* revenue attribution

---

## Design Goals

Economic impact should be:

* explainable
* tenant-configurable
* auditable
* independent from traffic scoring

