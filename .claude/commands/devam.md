---
description: AgentShield observatory — pick up where the work left off
---

Read `CLAUDE.md` at the repository root before doing anything else. It says which
of the two systems in this repository is live and lists the constraints that were
each learned by breaking something.

Then establish where things stand, from the record rather than from assumption:

```bash
git log --oneline -8
node public-site/findings/cli.js list
sqlite3 reality.db "SELECT COUNT(*) FROM RequestReality"
```

Report in Turkish, briefly: what the last few commits changed, whether anything is
waiting for a human decision, and what the obvious next step is. If the user has
said what they want in this message, do that instead of proposing something —
this command is for orientation, not for taking over the direction of the work.

Do not restart services, do not publish anything, and do not start writing code
before saying what you found.

$ARGUMENTS
