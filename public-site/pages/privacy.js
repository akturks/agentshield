import { page } from "../layout.js";

// Set PRIVACY_CONTACT to an address that actually receives mail. Until it is
// set the page says there is none, which is true and is better than printing
// one that bounces on the page explaining what the site does with your data.
const CONTACT_ADDRESS = process.env.PRIVACY_CONTACT ?? null;

// Written on 28 July 2026, the day the record was found to be holding 520
// visitor cookie values it had no use for.
//
// The temptation with a page like this is to write what sounds safest —
// "processes no personal data", "for security purposes only". Both would be
// false here, and a false statement of purpose is worse than none: it misstates
// the basis for processing and it is the first thing anyone would check.
//
// So this says what the record actually holds, including the part that was
// wrong and how it was fixed. That is also the more defensible document.

export function privacy(canary, published) {
  return page({
    title: "What this site records",
    description:
      "Every request to this site is recorded and the record is published as measurements. What that includes, why, for how long, and what was removed.",
    path: "/privacy",
    canary,
    published,
    body: `
<h1>What this site records</h1>

<p>This site measures how automated clients read the web, and the measurement <em>is</em> the server record. So it records every request that reaches it — including yours, if you are reading this in a browser.</p>

<p>That is unusual enough to state plainly rather than bury.</p>

<h2>What is recorded</h2>

<p>For every request: the time, the method and path, the response status and size, how long it took, the connecting address, the country that address resolves to, and the request headers — user agent, accepted languages and encodings, referer.</p>

<p>The connecting address is personal data. It is recorded because it is the only thing that distinguishes one caller from another, and almost every measurement here depends on that distinction — whether one client took many paths, whether many addresses shared one identity, whether an address falls inside a range a vendor publishes for its crawler.</p>

<h2>What is not recorded, and what stopped being recorded</h2>

<p>This site sets no cookies, runs no analytics, has no login, no form, no newsletter and no list. Nothing here tracks anyone between visits.</p>

<p>It did, however, store request headers exactly as they arrived, and on 28 July 2026 that record was found to contain <strong>520 <code>Cookie</code> values</strong> carrying a persistent per-visitor identifier — sent by clients, kept by the capture because it had been written to keep everything. Nothing on this site had ever read one, and no published figure was computed from one.</p>

<p>The capture now replaces the value of <code>Cookie</code>, <code>Set-Cookie</code>, <code>Authorization</code> and <code>Proxy-Authorization</code> with <code>[redacted]</code> before storing. The header <em>name</em> is kept, because which headers a client sends is part of how it behaves and is one of the things this site exists to measure. What the value contains is not ours.</p>

<h2>How long it is kept</h2>

<p>Indefinitely, and this deserves the same plainness. The record is append-only and is never edited, because a measurement that can be revised afterwards is not a measurement. Findings published months apart are recomputed against the same record, and that only works if the record is still there.</p>

<p>Backups are kept for 30 days.</p>

<h2>What is published</h2>

<p>Aggregates, and the queries that produced them. Not the log.</p>

<p>As of this writing, one connecting address appears anywhere in a published finding: an address that ran an automated scan against this site. No address belonging to an ordinary visitor has been published, and the addresses listed on <a href="/verify">the verification page</a> are ranges the vendors publish themselves for their own crawlers.</p>

<p>The operator console, which does show full addresses, runs on the loopback interface and is not routed through the tunnel that serves this site. It is not reachable from the internet.</p>

<h2>Requests triggered by a person</h2>

<p>When someone asks an assistant to open a page here, the request arrives from that vendor's cloud infrastructure, not from the person. Their address never reaches this server, so there is nothing here to identify them by.</p>

<h2>Asking for something to be removed or corrected</h2>

<p>Write, and say which. A request to remove an address from the record, a request to correct a figure, and a request to correct a sentence are three different things and get three different answers.</p>

<p>A correction that lands is published <em>as</em> a correction, dated, rather than folded silently into an edit. The <a href="/findings">findings</a> already carry withdrawn conclusions and rejected ones with the reason kept beside each, and this page carries the cookie mistake for the same reason.</p>

${
      CONTACT_ADDRESS
        ? `<p>Write to <a href="mailto:${CONTACT_ADDRESS}"><code>${CONTACT_ADDRESS}</code></a>.</p>`
        : `<p><strong>There is no address here yet.</strong> Saying so is better than printing one that receives nothing, and a page about what this site records is the wrong place to start being approximate. Until one is published, a removal or correction request has nowhere to go — which is a real gap, stated rather than papered over.</p>`
    }

<h2>Who runs this</h2>

<p>One person, in Türkiye. It is not a company, sells nothing, and takes no payment. The domain registration is not hidden behind an anonymising service, because a site that publishes measurements about named organisations while concealing its own operator would not deserve to be believed.</p>
`
  });
}
