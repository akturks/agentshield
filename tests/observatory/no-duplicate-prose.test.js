import test from "node:test";
import assert from "node:assert/strict";

import { escapeHtml } from "../../public-site/layout.js";
import { published } from "../../public-site/findings/engine.js";
import { findingsIndex } from "../../public-site/pages/findings.js";
import { home } from "../../public-site/pages/content.js";

// One paragraph, one page.
//
// A finding's summary is its own sentence about what happened, and it belongs
// on the finding and in the week that decided it. It sat on the archive index
// as well, so a reader walking /weekly → /findings met the same paragraph
// twice in a row — which is the thing this site says about its own pages and
// then stopped doing.
//
// Tested rather than remembered. The duplication arrived because a page was
// improved without checking what the neighbouring page already said, and that
// is not a mistake anyone makes once.

const CANARY = "asd-test-marker-000000";
const PUBLISHED = "2026-07-27T12:00:00.000Z";

test("the findings index lists headlines, not summaries", () => {
  const html = findingsIndex(CANARY, PUBLISHED);

  for (const finding of published()) {
    assert.ok(
      html.includes(escapeHtml(finding.title)),
      `the archive omits "${finding.title}"`
    );
    assert.ok(
      !html.includes(escapeHtml(finding.summary)),
      `the archive repeats the summary of "${finding.title}", which the weekly already carries`
    );
  }
});

test("the home page links findings without restating them", () => {
  // The front page carries four headlines as links. If it ever grows summaries
  // the same paragraph is on three pages, and the front page is the one a first
  // visitor reads before either of the others.
  const html = home(CANARY, PUBLISHED);

  for (const finding of published()) {
    assert.ok(
      !html.includes(escapeHtml(finding.summary)),
      `the home page restates "${finding.title}"`
    );
  }
});
