# What this site records — template

Copy this to a page on your site and edit the bracketed parts. Everything not
bracketed is already true of the recorder as shipped; if you change how it runs,
change the text to match.

The one rule: **it has to be true.** A notice claiming you process no personal
data while recording IP addresses is worse than having none, because it
misstates your basis for processing and it is the first thing anyone checks.

---

## What is recorded

Every request that reaches this server is recorded: the time, the method and
path, the response status and size, how long it took, the connecting address,
the country that address resolves to, and the request headers — user agent,
accepted languages and encodings, referer.

The connecting address is personal data. It is recorded because it is the only
thing that distinguishes one caller from another, and [**describe what you use
it for — e.g. "distinguishing automated clients from readers", "establishing
whether a request came from an address a vendor publishes for its crawler"**].

## Lawful basis

[**Legitimate interest** is the usual basis for server logs — GDPR Art. 6(1)(f),
KVKK Art. 5/2(f). State yours plainly. Consent is not normally required for
server logs and asking for it implies it is.]

## What is not recorded

This site sets no cookies, runs no analytics, and loads nothing from a third
party. Nothing here tracks anyone between visits.

The values of `Cookie`, `Set-Cookie` and `Authorization` headers are replaced
with `[redacted]` before storage. The header name is kept; the contents are not.

## How long it is kept

[**Pick one and mean it:**

- *"Records are deleted after N days."* — say the number.
- *"Records are kept indefinitely, because [reason]."* — indefinite retention is
  defensible when the purpose requires it, such as recomputing a published figure
  years later. It is not defensible by accident. Write the reason down.]

Backups are kept for [**N**] days.

## What is published

[**If you publish nothing, say so — it is the strongest sentence here.**

If you publish figures drawn from this record, say that aggregates are published
and the log is not, and check that no individual address appears in anything you
put out. Addresses hide in places prose does not: inside a published query,
inside an example, inside a screenshot.]

## Who can see it

[**Describe access honestly.** If an admin interface shows individual requests,
say where it runs and who can reach it. "It runs on the loopback interface and
is not reachable from the internet" is a real control worth stating.]

## Contact

[**An address that receives mail.** If there is not one yet, say that instead of
printing one that bounces — but a page about what you do with people's data is
the wrong page to leave without a route.]

Requests to remove an address, to correct a figure, and to correct a sentence
are three different things and get three different answers.

## Who runs this

[**Who is responsible, and which jurisdiction's law applies.** A reader needs to
know where to complain. Naming the country is usually enough; naming yourself is
your choice.]
