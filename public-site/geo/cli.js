#!/usr/bin/env node
import { SITE_ORIGIN } from "../layout.js";
import { indexNowKey, submit, submissionOutcomes } from "./indexnow.js";
import { publicUrls } from "../robots.js";

//   node public-site/geo/cli.js key       show the IndexNow key and its file URL
//   node public-site/geo/cli.js submit    announce every public URL
//   node public-site/geo/cli.js status    what was announced, and whether it was fetched

const [, , cmd] = process.argv;

switch (cmd) {
  case "key":
    console.log(`key:      ${indexNowKey()}`);
    console.log(`hosted:   ${SITE_ORIGIN}/${indexNowKey()}.txt`);
    break;

  case "submit": {
    const urls = publicUrls().map((p) => `${SITE_ORIGIN}${p}`);
    console.log(`announcing ${urls.length} URLs to IndexNow…`);
    const r = await submit(urls);
    console.log(
      r.ok
        ? `accepted (HTTP ${r.status}), ${r.count} URLs recorded`
        : `not accepted (HTTP ${r.status ?? "no response"}) — ${r.note ?? "no detail"}`
    );
    console.log(
      "\nThe announcement is recorded either way. Whether an index acts on it is\n" +
        "the measurement; run `status` in a few hours."
    );
    break;
  }

  case "status": {
    const rows = submissionOutcomes();
    if (rows.length === 0) {
      console.log("nothing announced yet");
      break;
    }
    console.log("\nURL                                        announced    first fetched after");
    for (const r of rows) {
      const path = r.url.replace(SITE_ORIGIN, "") || "/";
      let delta = "— not yet";
      if (r.firstFetchedAt) {
        const mins = Math.round(
          (new Date(r.firstFetchedAt).getTime() - r.submittedAtMs) / 60000
        );
        delta = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
      }
      console.log(
        `${path.padEnd(42)} ${r.submittedAt.slice(5, 16).replace("T", " ")}  ${delta}`
      );
    }
    const fetched = rows.filter((r) => r.firstFetchedAt).length;
    console.log(
      `\n${fetched}/${rows.length} announced URLs have since been fetched by a client that is not us.`
    );
    break;
  }

  default:
    console.log("usage: cli.js key|submit|status");
}
