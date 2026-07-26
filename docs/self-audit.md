# What this repository is, checked against what it says

Repository at `09fd8e56` with uncommitted changes at scan time, scanned 2026-07-26T14:44:11.823Z. Method version `scan-7/arch-det-7/arch-tpl-9/arch-ver-8`.

6 finding(s), each reviewed by a person before it appeared here. Every figure was recomputed by a second, independent route before it was written down, and each carries the command that reproduces it — so a reader who doubts a number does not have to take this document's word for it.


---

## 2 files in `tools` are reached by no import in the running program

No import or require statement in the program resolves to any of 2 files in `tools`. 0 of them are described by name in the documentation. The oldest arrived in 7663e33d, "chore(tools): add the local repository-analyst and memory experiments", today.

## The files

| File | Added | Documented in | Ever imported |
| --- | --- | --- | --- |
| `tools/repo-agent.js` | 7663e33d · 2026-07-25 | — | no |
| `tools/repo-analyst.js` | 7663e33d · 2026-07-25 | — | no |

## Never imported, at any point in the history

- `tools/repo-agent.js`
- `tools/repo-analyst.js`

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
import specifiers with its own parser, and the check below asks git whether the name
appears in any import or require in the tree.

| Figure | Value |
| --- | --- |
| How many files in `tools` are reached by no import in the program, tests aside | 2 |
| How many of those the documentation describes by name | 0 |
| How many were never imported by any commit in the history | 2 |

Each figure again, with the command that reproduces it:

**How many files in `tools` are reached by no import in the program, tests aside**

```
for f in tools/repo-agent.js tools/repo-analyst.js; do b=$(basename "$f" .js); git grep -qE "(from|require\()[^\"']*[\"'][^\"']*\$b(\.js)?[\"']" -- "*.js" || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
for f in tools/repo-agent.js tools/repo-analyst.js; do git grep -l -F "$(basename "$f")" -- "*.md" >/dev/null && echo "$f"; done | wc -l
```

**How many were never imported by any commit in the history**

```
# per file: git log --pickaxe-regex -S'(from|require)[^\n]*<basename>' -- '*.js' | wc -l
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without being imported
— from a service manager, a container command, a `<script>` tag, a plugin loader that
builds a path at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so: this codebase passes its
collaborators as arguments, so an import graph would report most of `src/services` as
dead. The question asked here is narrower and checkable — whether any import statement
resolves to the file.


---

## 9 files in `src/services` are reached by no import in the running program

No import or require statement in the program resolves to any of 9 files in `src/services`. 2 of them are described by name in the documentation. The oldest arrived in d7fd3e3f, "Implement outcome engine v1", 49 days ago.

## The files

| File | Added | Documented in | Ever imported |
| --- | --- | --- | --- |
| `src/services/correlationEngineService.js` | 05e974ba · 2026-06-18 | — | no |
| `src/services/feedbackEngineService.js` | f4a19ef3 · 2026-06-06 | — | yes |
| `src/services/hypothesisEvidenceService.js` | a1c01018 · 2026-06-20 | — | no |
| `src/services/hypothesisGenerationService.js` | ef6b2461 · 2026-06-18 | — | no |
| `src/services/hypothesisValidationService.js` | 0cdbc6b1 · 2026-06-20 | — | no |
| `src/services/knowledgePromotionService.js` | 09925215 · 2026-06-20 | `docs/ONTOLOGY.md` | no |
| `src/services/learningEngineService.js` | a0b348ae · 2026-06-06 | — | yes |
| `src/services/outcomeEngineService.js` | d7fd3e3f · 2026-06-06 | `SYSTEM_OF_RECORD.md`, `qwen3-memory/investigations/1782115017480-outcome-engine-investigation.md` | yes |
| `src/services/trustUpdateEngineService.js` | 9b8535c5 · 2026-06-06 | — | yes |

## Described in the documentation, and not run

- `src/services/knowledgePromotionService.js` — named in `docs/ONTOLOGY.md`
- `src/services/outcomeEngineService.js` — named in `SYSTEM_OF_RECORD.md`, `qwen3-memory/investigations/1782115017480-outcome-engine-investigation.md`

A reader of those documents would take these modules for part of the running system. A
reader of the import graph would not find them at all. Which of the two is wrong is not
something this finding decides.
## Never imported, at any point in the history

- `src/services/correlationEngineService.js`
- `src/services/hypothesisEvidenceService.js`
- `src/services/hypothesisGenerationService.js`
- `src/services/hypothesisValidationService.js`
- `src/services/knowledgePromotionService.js`

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
import specifiers with its own parser, and the check below asks git whether the name
appears in any import or require in the tree.

| Figure | Value |
| --- | --- |
| How many files in `src/services` are reached by no import in the program, tests aside | 9 |
| How many of those the documentation describes by name | 2 |
| How many were never imported by any commit in the history | 5 |

Each figure again, with the command that reproduces it:

**How many files in `src/services` are reached by no import in the program, tests aside**

```
for f in src/services/correlationEngineService.js src/services/feedbackEngineService.js src/services/hypothesisEvidenceService.js src/services/hypothesisGenerationService.js src/services/hypothesisValidationService.js src/services/knowledgePromotionService.js src/services/learningEngineService.js src/services/outcomeEngineService.js src/services/trustUpdateEngineService.js; do b=$(basename "$f" .js); git grep -qE "(from|require\()[^\"']*[\"'][^\"']*\$b(\.js)?[\"']" -- "*.js" || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
for f in src/services/correlationEngineService.js src/services/feedbackEngineService.js src/services/hypothesisEvidenceService.js src/services/hypothesisGenerationService.js src/services/hypothesisValidationService.js src/services/knowledgePromotionService.js src/services/learningEngineService.js src/services/outcomeEngineService.js src/services/trustUpdateEngineService.js; do git grep -l -F "$(basename "$f")" -- "*.md" >/dev/null && echo "$f"; done | wc -l
```

**How many were never imported by any commit in the history**

```
# per file: git log --pickaxe-regex -S'(from|require)[^\n]*<basename>' -- '*.js' | wc -l
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without being imported
— from a service manager, a container command, a `<script>` tag, a plugin loader that
builds a path at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so: this codebase passes its
collaborators as arguments, so an import graph would report most of `src/services` as
dead. The question asked here is narrower and checkable — whether any import statement
resolves to the file.


---

## 4 files in `src/domain/evidence` are reached by no import in the running program

No import or require statement in the program resolves to any of 4 files in `src/domain/evidence`. 0 of them are described by name in the documentation. The oldest arrived in a18dfb06, "refactor(core): move derivation out of the repository layer into services", today.

## The files

| File | Added | Documented in | Ever imported |
| --- | --- | --- | --- |
| `src/domain/evidence/AuditEvidence.js` | a18dfb06 · 2026-07-25 | — | no |
| `src/domain/evidence/CalibrationEvidence.js` | a18dfb06 · 2026-07-25 | — | no |
| `src/domain/evidence/Evidence.js` | a18dfb06 · 2026-07-25 | — | yes |
| `src/domain/evidence/EvidenceVerificationEvent.js` | a18dfb06 · 2026-07-25 | — | yes |

## Never imported, at any point in the history

- `src/domain/evidence/AuditEvidence.js`
- `src/domain/evidence/CalibrationEvidence.js`

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
import specifiers with its own parser, and the check below asks git whether the name
appears in any import or require in the tree.

| Figure | Value |
| --- | --- |
| How many files in `src/domain/evidence` are reached by no import in the program, tests aside | 4 |
| How many of those the documentation describes by name | 0 |
| How many were never imported by any commit in the history | 2 |

Each figure again, with the command that reproduces it:

**How many files in `src/domain/evidence` are reached by no import in the program, tests aside**

```
for f in src/domain/evidence/AuditEvidence.js src/domain/evidence/CalibrationEvidence.js src/domain/evidence/Evidence.js src/domain/evidence/EvidenceVerificationEvent.js; do b=$(basename "$f" .js); git grep -qE "(from|require\()[^\"']*[\"'][^\"']*\$b(\.js)?[\"']" -- "*.js" || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
for f in src/domain/evidence/AuditEvidence.js src/domain/evidence/CalibrationEvidence.js src/domain/evidence/Evidence.js src/domain/evidence/EvidenceVerificationEvent.js; do git grep -l -F "$(basename "$f")" -- "*.md" >/dev/null && echo "$f"; done | wc -l
```

**How many were never imported by any commit in the history**

```
# per file: git log --pickaxe-regex -S'(from|require)[^\n]*<basename>' -- '*.js' | wc -l
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without being imported
— from a service manager, a container command, a `<script>` tag, a plugin loader that
builds a path at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so: this codebase passes its
collaborators as arguments, so an import graph would report most of `src/services` as
dead. The question asked here is narrower and checkable — whether any import statement
resolves to the file.


---

## 5 files in `repositories` are reached by no import in the running program

No import or require statement in the program resolves to any of 5 files in `repositories`. 0 of them are described by name in the documentation. The oldest arrived in 28d31607, "Add trust engine foundation", 52 days ago.

## The files

| File | Added | Documented in | Ever imported |
| --- | --- | --- | --- |
| `repositories/confidenceRepository.js` | 2094c273 · 2026-06-05 | — | yes |
| `repositories/intentRepository.js` | 1875603d · 2026-06-04 | — | yes |
| `repositories/trustAssessmentRepository.js` | 9783c5c8 · 2026-06-05 | — | yes |
| `repositories/trustDimensionsRepository.js` | 27ace802 · 2026-06-05 | — | yes |
| `repositories/trustRepository.js` | 28d31607 · 2026-06-03 | — | yes |


## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
import specifiers with its own parser, and the check below asks git whether the name
appears in any import or require in the tree.

| Figure | Value |
| --- | --- |
| How many files in `repositories` are reached by no import in the program, tests aside | 5 |
| How many of those the documentation describes by name | 0 |
| How many were never imported by any commit in the history | 0 |

Each figure again, with the command that reproduces it:

**How many files in `repositories` are reached by no import in the program, tests aside**

```
for f in repositories/confidenceRepository.js repositories/intentRepository.js repositories/trustAssessmentRepository.js repositories/trustDimensionsRepository.js repositories/trustRepository.js; do b=$(basename "$f" .js); git grep -qE "(from|require\()[^\"']*[\"'][^\"']*\$b(\.js)?[\"']" -- "*.js" || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
for f in repositories/confidenceRepository.js repositories/intentRepository.js repositories/trustAssessmentRepository.js repositories/trustDimensionsRepository.js repositories/trustRepository.js; do git grep -l -F "$(basename "$f")" -- "*.md" >/dev/null && echo "$f"; done | wc -l
```

**How many were never imported by any commit in the history**

```
# per file: git log --pickaxe-regex -S'(from|require)[^\n]*<basename>' -- '*.js' | wc -l
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without being imported
— from a service manager, a container command, a `<script>` tag, a plugin loader that
builds a path at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so: this codebase passes its
collaborators as arguments, so an import graph would report most of `src/services` as
dead. The question asked here is narrower and checkable — whether any import statement
resolves to the file.


---

## `trafficQuality` is compared against the same 2 boundaries in 2 separate files

2 files decide something by comparing `trafficQuality` against the same boundaries: `80`, `50`. The comparison exists at 4 places across 2 files, and the earliest of them had a twin from a18dfb06 onward — today.

## Where it is

| File | Line | Value | As written |
| --- | --- | --- | --- |
| `repositories/eventRepository.js` | 230 | `80` | `if (trafficQuality >= 80) {` |
| `src/services/sessionProfileService.js` | 107 | `80` | `if (trafficQuality >= 80) {` |
| `repositories/eventRepository.js` | 225 | `50` | `if (trafficQuality >= 50) {` |
| `src/services/sessionProfileService.js` | 102 | `50` | `if (trafficQuality >= 50) {` |

## When this started

`trafficQuality` first got one of these boundaries in a9e8d833, "Implement traffic tier engine v1", on 2026-06-08.

A second file gained the same boundary 48 days later, in a18dfb06, "refactor(core): move derivation out of the repository layer into services" — today.

- `80` — duplicated from a18dfb06, 2026-07-25; neither site has been edited since
- `50` — duplicated from a18dfb06, 2026-07-25; neither site has been edited since

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan
counts what its own lexer found, and the check below counts what git's regex engine
finds in the working tree.

| Figure | Value |
| --- | --- |
| How many files compare `trafficQuality` against every one of these 2 value(s) | 2 |
| How many places compare `trafficQuality` against one of these value(s) | 4 |
| The commit where this expression first had a threshold in two files | a18dfb06 |

Each figure again, with the command that reproduces it:

**How many files compare `trafficQuality` against every one of these 2 value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' '*.mjs' '*.cjs' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `trafficQuality` against one of these value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' '*.mjs' '*.cjs' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**The commit where this expression first had a threshold in two files**

```
git log --pickaxe-regex -S'(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*80' --reverse --format='%h %aI %s' -- src/services/sessionProfileService.js | head -1
```

## What this finding does not say

Two files agreeing on a boundary can be deliberate. Nothing here establishes that
the repetition is a defect — only that the numbers exist in more than one place, and
since when.

Nothing here establishes that both sites run. A boundary duplicated into code that
nothing calls is a different problem with a different fix, and the reader who
reconciles two numbers when one of them is unreachable has been sent to the wrong
work. This paragraph is not a hedge — it is the one limit of this detector that
changes what to do about a finding, so it is stated on every one of them until a
detector exists that can settle the question.

The scan reads text rather than syntax. A boundary assembled by arithmetic, or held
in a variable and compared elsewhere, is invisible to it.


---

## `risk.riskScore` is compared against the same 3 boundaries in 2 separate files

2 files decide something by comparing `risk.riskScore` against the same boundaries: `90`, `70`, `50`. The comparison exists at 6 places across 2 files, and the earliest of them had a twin from 17e8f958 onward — 49 days ago.

## Where it is

| File | Line | Value | As written |
| --- | --- | --- | --- |
| `src/services/allocationEngineService.js` | 13 | `90` | `if (risk.riskScore >= 90) {` |
| `src/services/policyEngineService.js` | 3 | `90` | `risk.riskScore >= 90` |
| `src/services/allocationEngineService.js` | 27 | `70` | `risk.riskScore >= 70` |
| `src/services/policyEngineService.js` | 12 | `70` | `risk.riskScore >= 70` |
| `src/services/allocationEngineService.js` | 42 | `50` | `risk.riskScore >= 50` |
| `src/services/policyEngineService.js` | 21 | `50` | `risk.riskScore >= 50` |

## When this started

`risk.riskScore` first got one of these boundaries in b67f34b8, "Implement allocation engine v1", on 2026-06-06.

A second file gained the same boundary 4 hours later, in 17e8f958, "Implement policy engine v1" — 49 days ago.

- `90` — duplicated from 17e8f958, 2026-06-06; neither site has been edited since
- `70` — duplicated from 17e8f958, 2026-06-06; neither site has been edited since
- `50` — duplicated from 17e8f958, 2026-06-06; neither site has been edited since

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan
counts what its own lexer found, and the check below counts what git's regex engine
finds in the working tree.

| Figure | Value |
| --- | --- |
| How many files compare `risk.riskScore` against every one of these 3 value(s) | 2 |
| How many places compare `risk.riskScore` against one of these value(s) | 6 |
| The commit where this expression first had a threshold in two files | 17e8f958 |

Each figure again, with the command that reproduces it:

**How many files compare `risk.riskScore` against every one of these 3 value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' '*.mjs' '*.cjs' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `risk.riskScore` against one of these value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' '*.mjs' '*.cjs' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**The commit where this expression first had a threshold in two files**

```
git log --pickaxe-regex -S'(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*90' --reverse --format='%h %aI %s' -- src/services/policyEngineService.js | head -1
```

## What this finding does not say

Two files agreeing on a boundary can be deliberate. Nothing here establishes that
the repetition is a defect — only that the numbers exist in more than one place, and
since when.

Nothing here establishes that both sites run. A boundary duplicated into code that
nothing calls is a different problem with a different fix, and the reader who
reconciles two numbers when one of them is unreachable has been sent to the wrong
work. This paragraph is not a hedge — it is the one limit of this detector that
changes what to do about a finding, so it is stated on every one of them until a
detector exists that can settle the question.

The scan reads text rather than syntax. A boundary assembled by arithmetic, or held
in a variable and compared elsewhere, is invisible to it.

