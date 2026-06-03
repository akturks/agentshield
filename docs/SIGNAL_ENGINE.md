# AgentShield Signal Engine

## Purpose

Signals transform raw events into behavioral intelligence.

Events are observations.

Signals are interpretations.

Trust is computed from signals.

---

## Signal Flow

Identity
↓
Events
↓
Signals
↓
Trust
↓
Decision

---

## Signal: admin_scanning

Description:

Entity repeatedly accesses administrative paths.

Examples:

* /admin
* /wp-admin
* /.env
* /config
* /administrator

Risk:

Medium

Trust Impact:

-10

---

## Signal: credential_stuffing

Description:

Repeated login attempts over a short period.

Examples:

* /login
* /signin
* /auth

Pattern:

Multiple authentication attempts.

Risk:

High

Trust Impact:

-20

---

## Signal: automated_enumeration

Description:

Large number of unique paths in a short time.

Examples:

20+ unique paths within seconds.

Risk:

High

Trust Impact:

-25

---

## Signal: suspicious_automation

Description:

Behavior indicates automated tooling.

Examples:

* curl
* wget
* scripted clients
* headless browsers

Risk:

Low to Medium

Trust Impact:

-5

---

## Signal: trusted_behavior

Description:

Consistent legitimate behavior over time.

Examples:

* repeated successful access
* stable navigation patterns
* long-term history

Trust Impact:

+10

---

## Design Principles

Signals must be:

* explainable
* deterministic
* auditable
* composable

Signals are facts.

Trust is interpretation.

Decision is action.

---

## Long-Term Goal

AgentShield should explain decisions through signals.

Bad:

Trust = 27

Good:

Trust = 27

Signals:

* admin_scanning
* automated_enumeration
* multiple_blocks

Reasoning should always be visible.
git add docs/SIGNAL_ENGINE.md
git commit -m "Define signal engine architecture"
Identity
↓
Memory
↓
Signals
↓
Trust
↓
Intent
↓
Decision

Current Status

Identity     ✅
Memory       ✅
Signals      🟡 Design Phase
Trust        🟡 Design Phase
Intent       🔵 Future Layer
Decision     ✅

Intent is currently a future capability.

Intent will be inferred from signals and trust patterns.

Example:

Signals:

* admin_scanning
* automated_enumeration

↓

Intent:
Reconnaissance

Signals:

* credential_stuffing
* multiple_login_failures

↓

Intent:
Credential Attack

## Future Intent Engine

Intent is inferred from signals.

Signals:
- admin_scanning
- automated_enumeration

↓

Intent:
Reconnaissance

---

Signals:
- credential_stuffing
- multiple_login_failures

↓

Intent:
Credential Attack

---

Signals:
- suspicious_automation
- automated_enumeration

↓

Intent:
Automation

---

Signals:
- trusted_behavior

↓

Intent:
Legitimate Usage
