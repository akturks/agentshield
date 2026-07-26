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

## What nine repositories showed

The tool has now been run against seven repositories it did not grow up in. Every number
below is after the defects those runs exposed were fixed, which was the point of running
them. The sections that follow describe those defects; what they have in common is that
none of them could have been found by reading this repository more carefully.

| Repository | Findings | Files read | What it is |
| --- | --- | --- | --- |
| express | 0 | 7 of 213 | mature library, small surface |
| winston | 0 | 19 of 116 | mature library |
| axios | 0 | 80 of 456 | mature library |
| pm2 | 0 | 172 of 938 | process manager |
| fastify | 1 | 37 of 395 | one real duplicated boundary, hand-checked |
| sequelize | 1 | 345 of 944 | TypeScript, in a monorepo with a CLI |
| etherpad-lite | 6 | 299 of 1108 | TypeScript, and 0 until it was read |
| agentshield | 6 | 131 of 225 | this repository |
| project-anchor | 6 | 88 of 104 | the author's other repository |

The finding count is not a quality score, and the table should not be read as one. The
quiet repositories are libraries: small, mature, and reviewed by many people. The one that
looks like the two written by a single person is etherpad-lite, a product with a decade of
history. What these findings track is **growth without a second reader**, and a large old
product accumulates that whoever writes it.

The "files read" column is in the table because a zero without it cannot be interpreted.
express is 7 files of 213 and its zero means something. etherpad-lite was 12 of 1108, and
its zero meant only that this tool could not read TypeScript — the same repository, read
properly, has six.

The column was first written into this table from memory and every figure in it was wrong.
They are now the output of `coverage()`, run once per repository. A table of numbers
nobody measured, inside a document arguing that figures must be recomputed independently,
is the failure this whole pipeline exists to make visible — including here.

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

Two more categories of false positive came out of a repository that ships a command-line
tool alongside a library:

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

### TypeScript, and the zero that was not a zero

This tool read `.js`, `.mjs` and `.cjs`. Both of the commercial-shaped projects picked for
this round are TypeScript, so it saw 12 of etherpad-lite's 1108 files and reported nothing
about them. That number was true and it was not an audit.

That is the more dangerous of the two ways to be wrong. A false positive gets argued with;
a report of "0 findings" reads as a clean bill of health rather than as a tool that was
not looking, and nothing in the output distinguished the two.

It turned out to be a lexer question rather than a method question, exactly as it looked:
the three-layer contract, the claim/verify shape and the dating all transferred unchanged.
What it cost was one list of extensions, which had been written out **seventeen times
across four files** — the same duplication this tool exists to find, in the tool.

| Repository | Files read before | after |
| --- | --- | --- |
| etherpad-lite | 12 | **299** |
| sequelize | 67 | **345** |

etherpad-lite went from 0 findings to 6. Two more things fell out of running it:

- The verifier counted a module as reached when any quoted string ended in its name.
  etherpad writes `fetch("./tokenTransfer")` for an HTTP route, `['importexport',
  'timeslider']` for toolbar buttons and `"admin": string` for a key in a type — three
  modules called alive by a pattern that had matched a URL, a label and a type. The scan
  had it right; a path literal now requires its extension, and a reference without one
  needs an import keyword to supply the evidence instead.
- Sixteen groups in etherpad compare one expression against one value with **two different
  operators**. `statusCode === 200` and `statusCode >= 200` are not the same boundary, and
  the detector had been merging them and labelling the group with whichever site came
  first. fastify and axios and sequelize each have such a pair too. Neither the verifier
  nor any run would have surfaced it: both sides built their pattern from the same first
  site, searched for one operator, and agreed. It was found by asking the databases a
  question instead of reading the output.

The coverage line stays now that the cause is fixed, and should. The next repository will
be mostly Python, or a monorepo where the Node part is a tenth of the tree.

### The declaration that was under a key nobody would have listed

sequelize's CLI keeps four subcommands in `packages/cli/src/_commands/migration`, and the
tool called all four dead. Nothing imports them and nothing writes their names down —
because `packages/cli/package.json` says:

    "oclif": { "commands": "./lib/_commands" }

oclif loads every file in that directory. The declaration was there the whole time, under
a key that no list of known keys would have contained, which is the argument against
lists of known keys. It also points at `lib`, which is build output and not in the
repository at all; the mapping back to `src` is declared too, in the sibling
`tsconfig.json` as `outDir` and `rootDir`.

So the reader now takes every string in every `package.json`, at any depth, keeps the ones
that resolve to something git tracks, and maps build paths back through tsconfig.

That version lasted one measurement. express declares `"files": ["index.js", "lib/"]` — a
**publish manifest**, listing what goes into the npm tarball and saying nothing about what
loads it. Honouring it marked all seven of express's program files as entry points and
silenced the detector for that repository completely. The tool would have reported a clean
express forever, and the finding count would not have changed, because it was already zero.

The fix is the distinction the first version skipped over. npm's own keys have known
meanings, so they are read by name and only the ones that name an entry point are used.
Every *other* top-level key is some tool's configuration block — `oclif`, `jest`,
`nodemon` — and a path inside one of those is that tool being told where to find things
to load. `files` is npm's and means "ship this"; `oclif.commands` is not and means "load
this".

One more rule came out of the same measurement: express declares no `main` and no
`exports` at all, and relies on Node's implicit `index.js`. Without that rule the package's
own front door read as dead code.

Both of these were found by looking at the entry-point count per repository before running
the detectors, which took a minute and is now the first thing to check after any change to
what counts as an entry point. A detector that has been switched off reports zero findings,
and so does a clean repository.

### Cost, measured rather than assumed

Cost tracks the age of a repository rather than its size: `git log --pickaxe-regex` walks
the whole history once per candidate, and one such walk over etherpad-lite's 10,001 commits
takes 7.3 seconds.

The claim "almost all of it is dating" was written into this file before it was checked.
It is right, and checking it produced two savings the guess would not have:

| | etherpad-lite |
| --- | --- |
| before | 445s |
| dating only what survives the grouping | 377s |
| asking git for the first hit instead of every hit | **318s** |

The first: the detector dated every candidate module and *then* dropped the directories
holding fewer than two. The work was thrown away after being paid for.

The second: `moduleHistory` collected every commit that ever touched a reference to a
module, stored the list in the finding's facts, and tested `.length > 0`. Nothing read the
list. `--max-count=1` ends the walk at the first hit, which on a module that *was*
referenced is usually immediate.

A module that never was still costs a full walk, and nothing can avoid that: proving
absence means looking everywhere. That is the floor.

agentshield takes about 25 seconds over 131 files. That is fine for a report run by hand
and disqualifying for anything that runs on every commit, which is worth knowing before it
is designed around rather than after.

### The first tests in this directory

`tests/arch/lexer.test.js` covers what a lexer defect looks like when it is silent, which
is the only kind this pipeline has produced. The regex-literal bug lived here from the
first commit, never threw, never made a figure look strange, and was found only when a
second consumer of the same function started asking a different question of it.

Six tests, and the one that matters asserts that a comment sitting below a regex literal
containing an apostrophe is still recognised as a comment. Written after the fix rather
than before it, which is worth admitting: the test exists because the defect taught what
to test for, and no amount of thinking about the lexer in advance had produced it.

### Two rules that were not added, and why

Reading etherpad's output raised the same objection twice: `` `d` is compared against the
same boundary in 2 separate files `` is a finding about a one-letter variable, and
sequelize's `length` is a property every array has. Both look like noise, and the obvious
fixes are a rule about the subject's shape or a rule about how common it is.

Both were measured against the findings from nine repositories before being written, and
both fail.

**"A dotted expression names something specific; a bare identifier does not."** The bare
subjects are `statusCode` in fastify, `trafficQuality` here and `lastLogged` in etherpad —
all three hand-verified, all three real. The rule would have deleted more true findings
than false ones.

**"A subject compared against many values across the repository is generic."** `evt.which`
appears at 11 sites against 6 distinct values in etherpad and is the best finding the tool
has produced there: three separate files hardcode `27` for the Escape key. `lastLogged`
appears at 2 sites against 1 value and is equally real. The two ends of the range are both
good.

| Subject | Sites | Distinct values | Files | Verdict by hand |
| --- | --- | --- | --- | --- |
| `evt.which` | 11 | 6 | 4 | real — Escape hardcoded in 3 files |
| `statusCode` | 8 | 5 | 3 | real |
| `d` | 9 | 4 | 2 | real — the same 60-second boundary in two date formatters |
| `risk.riskScore` | 6 | 3 | 2 | real |
| `trafficQuality` | 4 | 2 | 2 | real |
| `lastLogged` | 2 | 1 | 2 | real |

So there is no discriminator here, and inventing one would mean choosing which true
findings to hide on the strength of how they read. The unit the detector already uses —
one expression, one operator, one value, in more than one file — is defensible, and every
finding already says the thing the counts cannot settle: a repeated threshold may be
deliberate, which is why a person reads it before it is published.

The negative result is recorded because it will occur to somebody again, and next time the
measurement is already done.

## The rules this pipeline publishes under

`pnpm run arch:check` — eight articles, executable.

The engine already refuses a great deal without being asked, and that was measured rather
than assumed. A candidate with no figures is refused. A figure with no way to check it is
refused. A figure that does not reproduce by a second route is refused. A detector written
next year cannot escape any of those, which is the part of the methodology that was
genuinely shared.

What the engine did not touch was everything a *reader* uses. The reproduce command beside
each figure was written to the database, printed, and published — and executed nowhere in
the pipeline, ever. The seven rules about how a finding may be worded were comments. So the
strongest sentence this tool can say, **do not believe me, run the command**, rested
entirely on somebody remembering to try it by hand.

Somebody did, three times. The first time, four of sixteen commands were fake.

| | |
| --- | --- |
| I | Every published figure reproduces — each command run as published, output compared |
| II | No figure published without a second opinion |
| III | Everything published was checked by the method now in force |
| IV | Every finding can be rebuilt from the observations |
| V | No finding counts this tool's own output as documentation |
| VI | Every figure is labelled with a question |
| VII | The report states facts and issues no instruction |
| VIII | The report says how much of the repository it read |

Articles VI and VII make two of the template rules executable. VII is an approximation and
says so: it reads sentences rather than meaning, and it distinguishes *"nothing here says
they should be deleted"* — a refusal to advise — from the tool speaking in the imperative.

### What the first run found

**4/8.** Three defects in the pipeline and one article that was simply wrong.

- Two published commands printed a hash, a date and a subject line beside a figure that is
  eight characters of hash. The command and the figure had disagreed about what was being
  asked for as long as the claim had existed.
- One figure was labelled *"The commit where this expression first had a threshold in two
  files"* — a fragment, not a question, in breach of a rule written three days earlier.
- The report was stale by one file, because a file had been added since it was generated.
- And Article III demanded that publication come after verification, which failed on all
  six findings. The pipeline was right: `restate` re-verifies a published finding under a
  newer method and keeps its publication date on purpose. An article forbidding that
  forbids the correction loop the whole tool is built on.

Rewriting a failing article is the dangerous move — it is how a check gets tuned until it
agrees with the code and enforces nothing. The distinction that makes it legitimate here is
whether the article asserted something the pipeline ever promised. That one did not; it
invented a guarantee about timestamps nothing had ever claimed. It now asks what a reader
actually depends on: not "this was checked at some point" but "this was checked by the code
you can go and read".

### And one the check caused

Article IV needed to know which detector ids exist, so it wrote its own list of two
strings — becoming the third copy of a definition, inside the file whose entire purpose is
refusing to let that happen. It passed, because both copies were right that day.

The registry is now a map from id to detector and the id is stamped onto each candidate
from it. That is the eighth time a duplicated definition has been found in this tool, and
the second time inside a change made to prevent one.

### Proof that the articles can fail

A check that cannot come back red is decoration. Three defects were injected into a copy of
the database — a reproduce command replaced with `echo 999`, a claim marked not-ok, and the
sentence *"You should delete these files"* appended to a published body — and articles I,
II and VII caught one each. 5/8.
