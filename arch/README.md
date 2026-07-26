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

Here the search happens twice by different machinery: the detector counts rows the
lexer in `scan.js` wrote, and the verifier counts what git's own regex engine finds in
the working tree. The observatory should probably adopt this, and that is a finding
about the observatory produced by building something else.

It earned itself on the first run. A doc comment in `arch/detectors.js` quotes
`risk.riskScore >= 90` as an example; git grep counted it, the scan did not, and the
finding was refused with `expected 6, observed 7`. Both sides were behaving
correctly — the question was which one to change.

The answer split the two ideas apart. What counts as *code* now comes from one
function, `stripCommentsAndStrings`, called by both paths: git finds candidate lines
and the file is re-read to drop the ones inside comments. Sharing that is deliberate,
because it is a *definition*, and the observatory learned at the cost of a wrong
published figure that a definition written twice becomes two definitions. Worth
having independence in the search; not worth having it in the vocabulary.

The reproduce commands carry the consequence. `git grep -nE '<pattern>'` prints seven
lines where the finding says six, so each command now says why, and the finding's
table of sites names every hit the figure counted.

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

## What eight repositories showed, and the one that decides whether this is a product

The tool has now been run against six repositories it did not grow up in. Every number
below is after the defects those runs exposed were fixed, which was the point of running
them:

| Repository | Findings | What it is |
| --- | --- | --- |
| express | 0 | mature library, small surface |
| axios | 0 | mature library |
| winston | 0 | mature library |
| etherpad-lite | 0 | large product — but see the scope limit below |
| pm2 | 0 | process manager, 177 program files |
| fastify | 1 | one real duplicated boundary, hand-checked |
| sequelize | 1 | 71 program files of 785 in the repository |
| agentshield | 6 | this repository |
| project-anchor | 6 | the author's other repository |

Five repositories out of seven show nothing at all, and the two that show six each were
written by one person without review. That is the shape the detectors were built to find,
and it is worth stating plainly rather than as a claim about code quality: what these
findings track is **growth without a second reader**, not competence.

Every published figure in `docs/self-audit.md` is now produced by pasting the command
printed beside it — all sixteen, checked by running them. Three of them could not have
been: they were sketches carrying a `<basename>` placeholder. A fourth ran and agreed with
its figure by accident, because `\$b` inside a double-quoted shell string is the literal
text `$b` rather than the variable, so it searched for something no file contains and
reported every file as unreferenced. It agreed with a figure of 9 by finding nothing at
all.

### pm2, and the limit of an independent verifier

pm2's first run reported four files in `lib/` as reached by nothing. All four are wrong.
`lib/God.js` starts them with
`path.resolve(path.dirname(module.filename), 'ProcessContainer.js')` and hands the result
to `child_process.fork` — no import keyword, no relative specifier, and a bare basename
that resolves relative to nothing.

The verifier did not catch it. That is the finding worth keeping from this run, because it
marks exactly what an independent second route buys and what it does not. Both paths asked
"does an import or require name this file", by different mechanisms, and agreed. A
mechanism defect surfaces as a disagreement; a **definition** that is too narrow gets
agreed on twice. Nothing inside this tool can find that. Only pointing it at code written
by someone else can, and that is now the reason to keep doing so rather than a hope.

The question the detector asks is now weaker and correspondingly harder to be wrong
about: does any line of the program write this file's name down. A path with whitespace in
it is excluded, because `"git log -- src/services/outcomeEngineService.js"` names a file
*to a subprocess* rather than loading it — the opposite thing.

### sequelize, and what counts as a declaration

Two more categories of false positive came out of the only repository here that is a
product rather than a library:

- `packages/cli/static/skeletons` — four files copied into somebody else's project. A
  skeleton nothing imports is a skeleton working as intended, exactly like an example.
- `.eslintrc.js` and `typedoc.js` — configuration read by the tool it configures.

The second is the interesting one, because the obvious rule for it is a hunch: *this
filename looks like a config*. The rule used instead is a declaration the project makes
about itself — a file at the repository root whose name matches a package in its own
`dependencies` is that package's configuration. sequelize declares `typedoc`; that is the
project saying what `typedoc.js` is for, and it does not require this tool to keep a list
of every config filename in the ecosystem.

### The report became an input to its own measurement

Every unimported-module finding counts how many Markdown files describe the module by
name, and the whole point of that figure is the gap it exposes: a module the documentation
presents as part of the system while nothing runs it. In this repository the honest count
was 2.

Writing the report into `docs/self-audit.md` and committing it made that 9 — because the
report names all nine modules, and `git grep` cannot tell the project's documentation from
the tool's own output. Every module was now "documented" by the document saying nothing
documented it. `repositories` went from 0 to 5 the same way.

This pipeline was built without an ACTION layer, on the stated grounds that it reads a
repository and does nothing to it. It grew one the moment its output was committed, and
the observatory's rule — the ACTION layer is never citable as evidence — turned out to
apply here after all. The report now writes `<!-- generated-by: arch -->` into itself, and
both the detector and the verifier exclude any Markdown carrying it. Recognised by a
marker rather than by path, because the path is a command-line argument.

Two things about this are worth keeping. It was silent: nothing failed, no figure looked
strange, and the number simply grew each time the report was regenerated. And an
independent verifier could never have caught it — both routes grep Markdown, so both would
have counted the report and agreed.

### The scope limit that matters more than any detector

Two of the four commercial-shaped projects picked for this round are TypeScript:

| Repository | JavaScript files | TypeScript files |
| --- | --- | --- |
| etherpad-lite | 41 | 514 |
| sequelize | 239 | 546 |

This tool reads `.js`, `.mjs` and `.cjs`. It therefore sees 16 files of etherpad-lite's
555, and reported 0 findings about them. That number is true and it is not an audit.

This is the more dangerous of the two ways to be wrong. A false positive gets argued with;
a report of "0 findings" reads as a clean bill of health rather than as a tool that was
not looking, and nothing in the output distinguishes the two.

No detector improvement changes it. It is the first thing to fix if these reports are ever
meant to be about somebody else's codebase, and it is a lexer question rather than a
method question: the three-layer contract, the claim/verify shape and the dating all
transfer to TypeScript unchanged. Until then, a run should say what share of the
repository it read, so a zero can be read for what it is.

### Cost

sequelize took **629 seconds**. Almost all of it is dating: `git log --pickaxe-regex`
walks 11,866 commits once per candidate module, and the candidate list is long before the
detectors group it. agentshield takes about 25 seconds over 127 files.

That is fine for a report run by hand and disqualifying for anything that runs on every
commit, which is worth knowing before it is designed around rather than after.
