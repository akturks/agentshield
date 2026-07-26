<!-- generated-by: arch -->

# What this repository is, checked against what it says

Repository at `6b2b1a3b` with uncommitted changes at scan time, scanned 2026-07-26T20:15:14.376Z. Method version `scan-16/arch-det-19/arch-tpl-14/arch-ver-12`.

This tool read **136 files**, out of 162 JavaScript and TypeScript files in the repository and 234 files in total. The 26 not read are tests, examples, type declarations or generated output. Nothing below is a statement about anything outside those 136 files.

6 finding(s), each reviewed by a person before it appeared here. Every figure was recomputed by a second, independent route before it was written down, and each carries the command that reproduces it — so a reader who doubts a number does not have to take this document's word for it.


---

## 2 files in `tools` are named nowhere in the running program

Nothing in the program names any of 2 files in `tools` — not an import, not a require, and not a path handed to something that loads a file. 0 of them are described by name in the documentation. The oldest arrived in 7663e33d, "chore(tools): add the local repository-analyst and memory experiments", yesterday.

## When this becomes a problem

The day someone reads `tools` and believes it.

Somebody opens this directory looking for where a thing is done, finds 2 files whose names say they do it, and cannot tell from the code that none of them are reached. The next change goes into one of them.

1 of these files never had a caller, so no commit broke anything and there is no bug report to find. The oldest arrived yesterday and has been here since.

## The files

| File | Added | Documented in | Ever named |
| --- | --- | --- | --- |
| `tools/repo-agent.js` | 7663e33d · 2026-07-25 | — | no |
| `tools/repo-analyst.js` | 7663e33d · 2026-07-25 | — | yes |

## Never named, at any point in the history

- `tools/repo-agent.js`

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
paths through its own index of the tree, and the check below asks git's regex engine
whether the name appears in any string literal in the code.

| Figure | Value |
| --- | --- |
| How many files in `tools` the program never names, tests aside | 2 |
| How many of those the documentation describes by name | 0 |
| How many the program has never named, in any commit in the history | 1 |

Each figure again, with the command that reproduces it:

**How many files in `tools` the program never names, tests aside**

```
for f in tools/repo-agent.js tools/repo-analyst.js; do b=$(basename "$f" .js); git grep -nE "((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | grep -vE 'node_modules/|\.(backup|bak|orig|old)(\.|$)|(^|/)(dist|build|vendor)/|(^|/)(test|tests|__tests__|spec|e2e|benchmarks?)/|\.(test|spec|smoke)\.|(^|/)(test|prisma|seed)-[^/]*\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$|\.d\.(ts|mts|cts)$|(^|/)(examples?|demos?|samples?|fixtures?)/|(^|/)(skeletons?|templates?|scaffolds?|stubs?|boilerplates?)/' | grep -vxF "$f" | grep -q . || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
gen=$(git grep -l -F '<!-- generated-by: arch -->' -- '*.md')
for f in tools/repo-agent.js tools/repo-analyst.js; do git grep -l -F "$(basename "$f")" -- '*.md' | grep -vxF "$gen" >/dev/null && echo "$f"; done | wc -l
```

**How many the program has never named, in any commit in the history**

```
n=0
for f in tools/repo-agent.js tools/repo-analyst.js; do b=$(basename "$f" .js); git log --pickaxe-regex -S"((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" --format=%H -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -q . || n=$((n+1)); done
echo "$n"
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without any code naming
it — from a service manager unit, a container command, a `<script>` tag, a path assembled
piece by piece at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so. A codebase that passes its
collaborators in as arguments has modules an import graph cannot see are alive, and
reporting those as dead would be worse than saying nothing. The question asked here is
narrower and checkable: does any line of the program write this file's name down.


---

## 9 files in `src/services` are named nowhere in the running program

Nothing in the program names any of 9 files in `src/services` — not an import, not a require, and not a path handed to something that loads a file. 2 of them are described by name in the documentation. The oldest arrived in d7fd3e3f, "Implement outcome engine v1", 50 days ago.

## When this becomes a problem

The day someone reads `src/services` and believes it.

The documentation names 2 of these as part of the system. Somebody planning a change reads that, budgets for it, and finds out afterwards that the code they were told about does not run — or worse, changes it and sees no effect, because nothing was calling it.

5 of these files never had a caller, so no commit broke anything and there is no bug report to find. The oldest arrived 50 days ago and has been here since.

## The files

| File | Added | Documented in | Ever named |
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
reader of the code would not find them named anywhere. Which of the two is wrong is not
something this finding decides.
## Never named, at any point in the history

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
paths through its own index of the tree, and the check below asks git's regex engine
whether the name appears in any string literal in the code.

| Figure | Value |
| --- | --- |
| How many files in `src/services` the program never names, tests aside | 9 |
| How many of those the documentation describes by name | 2 |
| How many the program has never named, in any commit in the history | 5 |

Each figure again, with the command that reproduces it:

**How many files in `src/services` the program never names, tests aside**

```
for f in src/services/correlationEngineService.js src/services/feedbackEngineService.js src/services/hypothesisEvidenceService.js src/services/hypothesisGenerationService.js src/services/hypothesisValidationService.js src/services/knowledgePromotionService.js src/services/learningEngineService.js src/services/outcomeEngineService.js src/services/trustUpdateEngineService.js; do b=$(basename "$f" .js); git grep -nE "((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | grep -vE 'node_modules/|\.(backup|bak|orig|old)(\.|$)|(^|/)(dist|build|vendor)/|(^|/)(test|tests|__tests__|spec|e2e|benchmarks?)/|\.(test|spec|smoke)\.|(^|/)(test|prisma|seed)-[^/]*\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$|\.d\.(ts|mts|cts)$|(^|/)(examples?|demos?|samples?|fixtures?)/|(^|/)(skeletons?|templates?|scaffolds?|stubs?|boilerplates?)/' | grep -vxF "$f" | grep -q . || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
gen=$(git grep -l -F '<!-- generated-by: arch -->' -- '*.md')
for f in src/services/correlationEngineService.js src/services/feedbackEngineService.js src/services/hypothesisEvidenceService.js src/services/hypothesisGenerationService.js src/services/hypothesisValidationService.js src/services/knowledgePromotionService.js src/services/learningEngineService.js src/services/outcomeEngineService.js src/services/trustUpdateEngineService.js; do git grep -l -F "$(basename "$f")" -- '*.md' | grep -vxF "$gen" >/dev/null && echo "$f"; done | wc -l
```

**How many the program has never named, in any commit in the history**

```
n=0
for f in src/services/correlationEngineService.js src/services/feedbackEngineService.js src/services/hypothesisEvidenceService.js src/services/hypothesisGenerationService.js src/services/hypothesisValidationService.js src/services/knowledgePromotionService.js src/services/learningEngineService.js src/services/outcomeEngineService.js src/services/trustUpdateEngineService.js; do b=$(basename "$f" .js); git log --pickaxe-regex -S"((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" --format=%H -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -q . || n=$((n+1)); done
echo "$n"
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without any code naming
it — from a service manager unit, a container command, a `<script>` tag, a path assembled
piece by piece at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so. A codebase that passes its
collaborators in as arguments has modules an import graph cannot see are alive, and
reporting those as dead would be worse than saying nothing. The question asked here is
narrower and checkable: does any line of the program write this file's name down.


---

## 4 files in `src/domain/evidence` are named nowhere in the running program

Nothing in the program names any of 4 files in `src/domain/evidence` — not an import, not a require, and not a path handed to something that loads a file. 0 of them are described by name in the documentation. The oldest arrived in a18dfb06, "refactor(core): move derivation out of the repository layer into services", yesterday.

## When this becomes a problem

The day someone reads `src/domain/evidence` and believes it.

Somebody opens this directory looking for where a thing is done, finds 4 files whose names say they do it, and cannot tell from the code that none of them are reached. The next change goes into one of them.

2 of these files never had a caller, so no commit broke anything and there is no bug report to find. The oldest arrived yesterday and has been here since.

## The files

| File | Added | Documented in | Ever named |
| --- | --- | --- | --- |
| `src/domain/evidence/AuditEvidence.js` | a18dfb06 · 2026-07-25 | — | no |
| `src/domain/evidence/CalibrationEvidence.js` | a18dfb06 · 2026-07-25 | — | no |
| `src/domain/evidence/Evidence.js` | a18dfb06 · 2026-07-25 | — | yes |
| `src/domain/evidence/EvidenceVerificationEvent.js` | a18dfb06 · 2026-07-25 | — | yes |

## Never named, at any point in the history

- `src/domain/evidence/AuditEvidence.js`
- `src/domain/evidence/CalibrationEvidence.js`

Nothing removed the last caller of these, because there was never a caller. They were
written and not wired. That is a different situation from a module that worked and was
later orphaned, and the fix for it is a different decision.

## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
paths through its own index of the tree, and the check below asks git's regex engine
whether the name appears in any string literal in the code.

| Figure | Value |
| --- | --- |
| How many files in `src/domain/evidence` the program never names, tests aside | 4 |
| How many of those the documentation describes by name | 0 |
| How many the program has never named, in any commit in the history | 2 |

Each figure again, with the command that reproduces it:

**How many files in `src/domain/evidence` the program never names, tests aside**

```
for f in src/domain/evidence/AuditEvidence.js src/domain/evidence/CalibrationEvidence.js src/domain/evidence/Evidence.js src/domain/evidence/EvidenceVerificationEvent.js; do b=$(basename "$f" .js); git grep -nE "((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | grep -vE 'node_modules/|\.(backup|bak|orig|old)(\.|$)|(^|/)(dist|build|vendor)/|(^|/)(test|tests|__tests__|spec|e2e|benchmarks?)/|\.(test|spec|smoke)\.|(^|/)(test|prisma|seed)-[^/]*\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$|\.d\.(ts|mts|cts)$|(^|/)(examples?|demos?|samples?|fixtures?)/|(^|/)(skeletons?|templates?|scaffolds?|stubs?|boilerplates?)/' | grep -vxF "$f" | grep -q . || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
gen=$(git grep -l -F '<!-- generated-by: arch -->' -- '*.md')
for f in src/domain/evidence/AuditEvidence.js src/domain/evidence/CalibrationEvidence.js src/domain/evidence/Evidence.js src/domain/evidence/EvidenceVerificationEvent.js; do git grep -l -F "$(basename "$f")" -- '*.md' | grep -vxF "$gen" >/dev/null && echo "$f"; done | wc -l
```

**How many the program has never named, in any commit in the history**

```
n=0
for f in src/domain/evidence/AuditEvidence.js src/domain/evidence/CalibrationEvidence.js src/domain/evidence/Evidence.js src/domain/evidence/EvidenceVerificationEvent.js; do b=$(basename "$f" .js); git log --pickaxe-regex -S"((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" --format=%H -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -q . || n=$((n+1)); done
echo "$n"
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without any code naming
it — from a service manager unit, a container command, a `<script>` tag, a path assembled
piece by piece at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so. A codebase that passes its
collaborators in as arguments has modules an import graph cannot see are alive, and
reporting those as dead would be worse than saying nothing. The question asked here is
narrower and checkable: does any line of the program write this file's name down.


---

## 5 files in `repositories` are named nowhere in the running program

Nothing in the program names any of 5 files in `repositories` — not an import, not a require, and not a path handed to something that loads a file. 0 of them are described by name in the documentation. The oldest arrived in 28d31607, "Add trust engine foundation", 52 days ago.

## When this becomes a problem

The day someone reads `repositories` and believes it.

Somebody opens this directory looking for where a thing is done, finds 5 files whose names say they do it, and cannot tell from the code that none of them are reached. The next change goes into one of them.

Something used to reach these files and no longer does. The commit that removed the last caller is in the history; nothing in the code says so.

## The files

| File | Added | Documented in | Ever named |
| --- | --- | --- | --- |
| `repositories/confidenceRepository.js` | 2094c273 · 2026-06-05 | — | yes |
| `repositories/intentRepository.js` | 1875603d · 2026-06-04 | — | yes |
| `repositories/trustAssessmentRepository.js` | 9783c5c8 · 2026-06-05 | — | yes |
| `repositories/trustDimensionsRepository.js` | 27ace802 · 2026-06-05 | — | yes |
| `repositories/trustRepository.js` | 28d31607 · 2026-06-03 | — | yes |


## Verified figures

Each was recomputed by a different route than the one that produced it: the scan resolves
paths through its own index of the tree, and the check below asks git's regex engine
whether the name appears in any string literal in the code.

| Figure | Value |
| --- | --- |
| How many files in `repositories` the program never names, tests aside | 5 |
| How many of those the documentation describes by name | 0 |
| How many the program has never named, in any commit in the history | 0 |

Each figure again, with the command that reproduces it:

**How many files in `repositories` the program never names, tests aside**

```
for f in repositories/confidenceRepository.js repositories/intentRepository.js repositories/trustAssessmentRepository.js repositories/trustDimensionsRepository.js repositories/trustRepository.js; do b=$(basename "$f" .js); git grep -nE "((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | grep -vE 'node_modules/|\.(backup|bak|orig|old)(\.|$)|(^|/)(dist|build|vendor)/|(^|/)(test|tests|__tests__|spec|e2e|benchmarks?)/|\.(test|spec|smoke)\.|(^|/)(test|prisma|seed)-[^/]*\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$|\.d\.(ts|mts|cts)$|(^|/)(examples?|demos?|samples?|fixtures?)/|(^|/)(skeletons?|templates?|scaffolds?|stubs?|boilerplates?)/' | grep -vxF "$f" | grep -q . || echo "$f"; done | wc -l
```

**How many of those the documentation describes by name**

```
gen=$(git grep -l -F '<!-- generated-by: arch -->' -- '*.md')
for f in repositories/confidenceRepository.js repositories/intentRepository.js repositories/trustAssessmentRepository.js repositories/trustDimensionsRepository.js repositories/trustRepository.js; do git grep -l -F "$(basename "$f")" -- '*.md' | grep -vxF "$gen" >/dev/null && echo "$f"; done | wc -l
```

**How many the program has never named, in any commit in the history**

```
n=0
for f in repositories/confidenceRepository.js repositories/intentRepository.js repositories/trustAssessmentRepository.js repositories/trustDimensionsRepository.js repositories/trustRepository.js; do b=$(basename "$f" .js); git log --pickaxe-regex -S"((from|require)[^'\"]*['\"\`]([^'\"\`[:space:]]*/)?$b(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?['\"\`]|['\"\`]([^'\"\`[:space:]]*/)?$b\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)['\"\`])" --format=%H -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -q . || n=$((n+1)); done
echo "$n"
```

## What this finding does not say

Nothing here says these files are unused. A module can be loaded without any code naming
it — from a service manager unit, a container command, a `<script>` tag, a path assembled
piece by piece at runtime. Files named by any non-JavaScript file in the repository are
already excluded for that reason, but a loader living outside the repository leaves no
trace inside it.

Nothing here says they should be deleted either. A module written ahead of the pipeline
that will use it looks exactly like one left behind by a pipeline that changed.

This is not reachability analysis, and deliberately so. A codebase that passes its
collaborators in as arguments has modules an import graph cannot see are alive, and
reporting those as dead would be worse than saying nothing. The question asked here is
narrower and checkable: does any line of the program write this file's name down.


---

## `trafficQuality` is compared against the same 2 boundaries in 2 separate files

2 files decide something by comparing `trafficQuality` against the same boundaries: `80`, `50`. The comparison exists at 4 places across 2 files, and the earliest of them had a twin from a18dfb06 onward — yesterday.

## When this becomes a problem

The day someone changes one of these numbers.

They open `repositories/eventRepository.js`, change `80` to something else, test it, and ship.
The other file still holds the old number. From then on the
program compares `trafficQuality` against two different boundaries depending on which path
the request took, and both are correct as far as any test knows, because each file is
internally consistent.

That is why the date matters more than the count. These have stood together for a day.

## Where it is

| File | Line | Value | As written |
| --- | --- | --- | --- |
| `repositories/eventRepository.js` | 230 | `80` | `if (trafficQuality >= 80) {` |
| `src/services/sessionProfileService.js` | 107 | `80` | `if (trafficQuality >= 80) {` |
| `repositories/eventRepository.js` | 225 | `50` | `if (trafficQuality >= 50) {` |
| `src/services/sessionProfileService.js` | 102 | `50` | `if (trafficQuality >= 50) {` |

## When this started

`trafficQuality` first got one of these boundaries in a9e8d833, "Implement traffic tier engine v1", on 2026-06-08.

A second file gained the same boundary 48 days later, in a18dfb06, "refactor(core): move derivation out of the repository layer into services" — yesterday.

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
| Which commit first put this threshold into a second file | a18dfb06 |

Each figure again, with the command that reproduces it:

**How many files compare `trafficQuality` against every one of these 2 value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `trafficQuality` against one of these value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**Which commit first put this threshold into a second file**

```
git log --pickaxe-regex -S'(^|[^_$.[:alnum:]])trafficQuality[[:space:]]*>=[[:space:]]*80' --reverse --format=%H -- src/services/sessionProfileService.js | head -1 | cut -c1-8
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

2 files decide something by comparing `risk.riskScore` against the same boundaries: `90`, `70`, `50`. The comparison exists at 6 places across 2 files, and the earliest of them had a twin from 17e8f958 onward — 50 days ago.

## When this becomes a problem

The day someone changes one of these numbers.

They open `src/services/allocationEngineService.js`, change `90` to something else, test it, and ship.
The other file still holds the old number. From then on the
program compares `risk.riskScore` against two different boundaries depending on which path
the request took, and both are correct as far as any test knows, because each file is
internally consistent.

That is why the date matters more than the count. These have stood together for 50 days.

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

A second file gained the same boundary 4 hours later, in 17e8f958, "Implement policy engine v1" — 50 days ago.

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
| Which commit first put this threshold into a second file | 17e8f958 |

Each figure again, with the command that reproduces it:

**How many files compare `risk.riskScore` against every one of these 3 value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `risk.riskScore` against one of these value(s)**

```
git grep -nE '(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' '*.mjs' '*.cjs' '*.jsx' '*.ts' '*.mts' '*.cts' '*.tsx' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**Which commit first put this threshold into a second file**

```
git log --pickaxe-regex -S'(^|[^_$.[:alnum:]])risk\.riskScore[[:space:]]*>=[[:space:]]*90' --reverse --format=%H -- src/services/policyEngineService.js | head -1 | cut -c1-8
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

