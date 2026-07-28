# AgentShield — working context

This file is what a session needs that the code does not say by itself. Everything
else is in the repository and should be read there rather than restated here.

## What is running

`public-site/` is the live observatory at **agentshieldaidefense.com**. It is the
active work. It measures how AI crawlers and agents read the web by recording every
request that arrives and publishing findings computed from that record.

The rest of the repository — `server.js`, `repositories/`, `routes/`, `prisma/` — is
the earlier private API. **`README.md` at the root describes that older system and
its continuation prompt points at a phase that is no longer current.** Do not start
from it.

Read `public-site/README.md` for how the site works, and `docs/CONSTITUTION.md` for
the rules the code is written to follow. `public-site/constitution.js` holds the
same rules as executable data; `public-site/integrity.js` checks the live site
against them and is expected to be all-green.

## What is irreplaceable

`reality.db` — the request record, INSERT-only, gitignored, and not reconstructable
from anything. Code is replaceable; this is not.

Backed up daily at 04:17 by `public-site/deploy/backup-reality.sh` via
`sqlite3 .backup` (never `cp`, which would copy a database mid-write), verified with
`integrity_check` before being kept, to `~/Backups/agentshield` and Google Drive,
30-day retention.

`observatory-v1` is the tag for the site as it stood on 2026-07-27: 11 findings
published, 81 tests, all articles green.

## Standing constraints

These were each established by something going wrong. They are not preferences.

- **`OPERATOR_ADDRESSES` in `stats.js` holds one entry** — `2a00:1d34:4896:b600::/64`.
  Other addresses that look like the operator's are not approved. Excluding an
  address on suspicion removes real observations from the record.
- **Never write the external-traffic filter by hand.** Import `notOperator()` or
  `EXTERNAL` from `stats.js`. Two divergent copies of that predicate would make two
  pages disagree about the same week.
- **Never `pkill -f "public-site/server.js"`.** It kills the live site. Restarts go
  through `launchctl kickstart -k gui/501/com.agentshield.publicsite` and are run by
  the user, not by an agent.
- **Never fetch a vendor's IP list at detection time.** Identity checks resolve
  against the dated snapshot in `public-site/vendors/`, so a published finding
  reproduces. `pnpm run vendors:refresh` is a separate, deliberate act.
- **Article IX: no published sentence makes a named crawler or client the
  grammatical subject of conduct.** "Amazonbot has been observed here" is a
  violation; "requests declaring Amazonbot were recorded" is not. This has been
  breached twice, both times in `findings/templates.js`, both times by a fallback
  branch nobody rendered in a test.
- **Publishing is the user's action.** Findings, social posts, anything outward
  facing. An agent prepares; a person publishes.
- **Rejecting a finding is permanent and is the user's decision.**
- **The site's own canary markers never appear in external writing.** Their value is
  that they exist in exactly one place.

## How the site thinks

Three layers, and the boundaries between them are the product:

1. **Reality** — what was observed, written once, never edited.
2. **Interpretation** — versioned, recomputable, always says which version.
3. **Action** — never citable as evidence for anything.

A figure is published with the query that produced it, and the verifier recomputes
every figure before publication; one mismatch discards the whole draft. The
recurring lesson, learned repeatedly: *a verification whose evidence comes from the
party being checked is not a verification.*

## Commands

```bash
pnpm test                                   # 81 tests
node public-site/findings/cli.js list       # published and held
node public-site/findings/cli.js recheck    # do published figures still hold
sqlite3 reality.db "SELECT COUNT(*) FROM RequestReality"
```

The operator console is a separate process on `127.0.0.1:8090`, deliberately not
routed through the tunnel, because it can publish.
