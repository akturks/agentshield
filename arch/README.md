# arch — the same method, pointed at a repository

`pnpm run arch run` reads this repository, records what is in it, concludes one
thing about it, checks that conclusion by a second route, and holds the result for
a person to read.

```
pnpm run arch scan      read the working tree, record what is in it
pnpm run arch run       scan, detect, verify, hold what survives
pnpm run arch list      what is held, what is published
pnpm run arch show <id> one finding with every figure and the command that reproduces it
pnpm run arch report    every held finding as one markdown document
pnpm run arch restate   rebuild findings against a fresh scan, keeping their identity
```

The layering is the observatory's, unchanged: `RepoScan` and `RepoReality` are
INSERT-only observations, `ArchFinding` and `ArchFindingClaim` are interpretation
and may be deleted and rebuilt from the rows above at any time. There is no action
layer, because this reads a repository and does nothing to it.

## Why it was built here

To find out which parts of the findings pipeline are actually general. Guessing at
that from a design document produces a framework shaped like the one example that
existed; building the second instance against the same engine produces a list.

**Carried over unchanged.** The order — detect, draft, verify, hold or publish. The
claim contract: a label, an expected value, and an independent way to recompute it.
The review queue with `approve` and `reject`. `restate`, which rebuilds a finding's
prose and figures under a newer method version while keeping its id, slug and
publication date, so improving the detector never means abandoning what it already
reported. Nothing publishes itself. The translation rules in `templates.js`.

**Could not be carried over.** The observatory's `verifier.js` takes SQL and calls
`db.prepare`; these claims are shell commands over a git repository. Its `engine.js`
imports its own database module directly, so it cannot be handed a different store.
`detectors.js` and `templates.js` are domain-specific in both pipelines and were
always going to be rewritten.

So the reusable core is the contract and the state machine, not the code that
implements them — roughly 400 of the observatory's 1600 lines, and the useful part
of that estimate is that it came from doing the work rather than from reading the
files.

## One difference worth keeping

The observatory verifies a claim by re-running its SQL against the same table the
detector read. That catches a stale figure and misses a wrong query.

Here the two paths are separate: the detector counts rows written by the lexer in
`scan.js`, and the verifier counts matches found by git's own regex engine in the
working tree. A defect in the lexer surfaces as a disagreement instead of as a
number that agrees with itself. The observatory should probably adopt this, and
that is a finding about the observatory, produced by building something else.

## What the first run found, and what reading it changed

Two findings, both verified, both held for review.

Three defects came out of reading the first report, not out of writing the code:

- Grouping per value reported `risk.riskScore >= 90`, `>= 70` and `>= 50` as three
  findings about the same two files. They are one finding. Five findings became two.
- The summary claimed the duplicated sites "have moved independently since", which
  nothing had checked. It is now a verified statement about commit counts, or absent.
- "0 days ago" was printed for anything less than a day old.

And one thing the detector cannot see, found by hand while checking whether the
`trafficQuality` finding was defensible: `getSessionProfile` in
`repositories/eventRepository.js` has no caller anywhere in the repository. The
commit that duplicated those thresholds was a move — `refactor(core): move
derivation out of the repository layer into services` — and it copied the logic
without deleting the original.

That is the specification for the second detector, and it arrived the right way
round: an exported name that appears nowhere else in the repository. Note how much
weaker that claim is than reachability. Reachability analysis is unusable here,
because `evaluatePipeline` receives every collaborator as an argument and would
report most of `src/services` as dead. A name mentioned nowhere is safe against
dependency injection, because injecting a function still mentions its name at the
injection site.
