# What this repository is, checked against what it says

Repository at `49627845` with uncommitted changes at scan time, scanned 2026-07-26T12:41:27.024Z. Method version `scan-1/arch-det-4/arch-tpl-5/arch-ver-2`.

2 finding(s), each reviewed by a person before it appeared here. Every figure was recomputed by a second, independent route before it was written down, and each carries the command that reproduces it — so a reader who doubts a number does not have to take this document's word for it.


---

## `risk.riskScore` is compared against the same 3 boundaries in 2 separate files

Two engines branch on `risk.riskScore` at the same boundaries: `90`, `70`, `50`. The comparison exists at 6 places across 2 files, and the earliest of them had a twin from 17e8f958 onward — 49 days ago.

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
git grep -nE 'risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `risk.riskScore` against one of these value(s)**

```
git grep -nE 'risk\.riskScore[[:space:]]*>=[[:space:]]*(90|70|50)' -- '*.js' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**The commit where this expression first had a threshold in two files**

```
git log --pickaxe-regex -S'risk\.riskScore[[:space:]]*>=[[:space:]]*90' --reverse --format='%h %aI %s' -- src/services/policyEngineService.js | head -1
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

## `trafficQuality` is compared against the same 2 boundaries in 2 separate files

Two engines branch on `trafficQuality` at the same boundaries: `80`, `50`. The comparison exists at 4 places across 2 files, and the earliest of them had a twin from a18dfb06 onward — today.

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
git grep -nE 'trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)' | cut -d: -f1 | sort -u
```

**How many places compare `trafficQuality` against one of these value(s)**

```
git grep -nE 'trafficQuality[[:space:]]*>=[[:space:]]*(80|50)' -- '*.js' | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

**The commit where this expression first had a threshold in two files**

```
git log --pickaxe-regex -S'trafficQuality[[:space:]]*>=[[:space:]]*80' --reverse --format='%h %aI %s' -- src/services/sessionProfileService.js | head -1
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

