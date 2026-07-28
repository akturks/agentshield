# Restoring this system

Last executed **2026-07-28**, from a clean clone and that morning's backups:
81 tests, 81 passing. The steps below are the ones that were actually run, not the
ones that seemed right — running them found two mistakes in the version that
seemed right, and both are noted where they occurred.

## What has to exist first

Three things, and only the third is a real dependency on anything outside this
machine:

| | Where | Replaceable? |
| --- | --- | --- |
| Code | `github.com/akturks/agentshield` | yes, it is the copy |
| The record | `~/Backups/agentshield`, and Google Drive | **no** |
| Cloudflare account | the domain, the DNS, the zone settings | **no** |

`~/.cloudflared/` (a certificate and a tunnel credential) is in no backup and does
not need to be. With access to the Cloudflare account, `cloudflared tunnel login`
issues new ones and `setup-tunnel.sh` re-points DNS. Losing those files costs a few
minutes; losing the account costs the domain.

The `launchd` plists are in no backup either, for the same reason:
`install-services.sh` writes them.

## The procedure

```bash
git clone https://github.com/akturks/agentshield.git && cd agentshield
pnpm install
```

Clone and stay on `main`. **Do not check out `observatory-v1` to restore.** The tag
marks the site as it stood on 2026-07-27, which is one commit before this document
and before `CLAUDE.md` — checking it out silently removes the file that explains
which system this is. The tag is for reading old code, not for coming back to.

```bash
gunzip -c ~/Backups/agentshield/reality-YYYY-MM-DD.db.gz    > reality.db
gunzip -c ~/Backups/agentshield/agentshield-YYYY-MM-DD.db.gz > agentshield.db
sqlite3 reality.db     "PRAGMA integrity_check;"   # must print: ok
sqlite3 agentshield.db "PRAGMA integrity_check;"   # must print: ok
```

**Both databases, not just `reality.db`.** The first restore attempt took only the
record — the observatory's own 53 tests passed and the other 28 failed with
`SQLITE_ERROR`, because the older private API keeps its own store. Restoring one
database produces a system that looks healthy from the direction you happen to
check.

```bash
node --test        # expect: 81 tests, 81 pass, 0 fail
```

If that number is not 81, stop here. A restore that has not been checked is a
belief about a restore.

```bash
cloudflared tunnel login                     # opens a browser
bash public-site/deploy/setup-tunnel.sh
bash public-site/deploy/install-services.sh
sudo pmset -a sleep 0 disablesleep 1         # sleep is a gap in the record
```

## Then check the CDN, before trusting anything the site says

In the Cloudflare dashboard, both must be **off**:

- **Block AI Scrapers and Crawlers**
- **AI Labyrinth**

Neither is visible from the origin. With them on, the edge prepends `Disallow: /`
for eight AI crawlers to a `robots.txt` that welcomes them by name, and injects a
hidden decoy link into every HTML page — so the site tells the crawlers it exists
to observe not to come, in a voice that is not its own. `docs/cdn-interventions.md`
has the measurements.

The check is a diff, not a dashboard reading:

```bash
curl -s https://agentshieldaidefense.com/robots.txt | wc -c   # origin serves 1468
```

## What a restored record is not

The backup runs at 04:17. Restoring it recovers the record up to that instant and
no further; requests observed between then and the failure are gone, and no figure
computed afterwards can know they existed. Say so when publishing across such a
gap rather than letting the totals imply continuity.
