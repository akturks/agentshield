import test from "node:test";
import assert from "node:assert/strict";

import {
  weekStart,
  weekLabel,
  weekFromLabel,
  weeksObserved,
  weeklyReport
} from "../../public-site/weekly.js";
import { weeklyPage } from "../../public-site/pages/weekly.js";
import { escapeHtml } from "../../public-site/layout.js";

// A weekly report is only worth publishing if the week it names is the week it
// counted. ISO week arithmetic is the kind of thing that looks right for eleven
// months and then puts a request in the wrong year on 29 December, so the
// boundaries are tested rather than trusted.

const DAY = 86400000;

test("a week starts on Monday at midnight UTC", () => {
  // 2026-07-27 is a Monday.
  const monday = Date.UTC(2026, 6, 27);
  assert.equal(weekStart(monday), monday, "Monday is its own week start");
  assert.equal(weekStart(monday + DAY * 3), monday, "Thursday belongs to it");
  assert.equal(weekStart(monday + DAY * 6 + 86399999), monday, "Sunday 23:59:59.999 too");
  assert.equal(weekStart(monday + DAY * 7), monday + DAY * 7, "the next Monday is a new week");
});

test("Sunday belongs to the week that began, not the one about to", () => {
  // The most common off-by-one: JavaScript's getUTCDay() makes Sunday 0, so a
  // naive implementation starts a new week a day early, every week.
  const sunday = Date.UTC(2026, 7, 2); // 2026-08-02
  assert.equal(weekLabel(sunday), "2026-W31");
  assert.equal(weekLabel(sunday + DAY), "2026-W32", "Monday opens the next one");
});

test("the ISO year is not always the calendar year", () => {
  // 29 December 2025 is a Monday and falls in ISO week 2026-W01. Labelling it
  // 2025 would file a week of the record under a year that never contained it.
  assert.equal(weekLabel(Date.UTC(2025, 11, 29)), "2026-W01");
  assert.equal(weekLabel(Date.UTC(2026, 0, 1)), "2026-W01", "1 January lands there too");
});

test("a label round-trips to the week it names", () => {
  for (const label of ["2026-W01", "2026-W30", "2026-W31", "2025-W52"]) {
    const start = weekFromLabel(label);
    assert.notEqual(start, null, `${label} must resolve`);
    assert.equal(weekLabel(start), label, `${label} must survive the round trip`);
  }
});

test("a label that does not name a real week is refused, not guessed", () => {
  // These reach the router as a URL segment. Answering with a plausible week for
  // a nonsense label would publish figures under a heading nobody asked for.
  for (const bad of ["2026-W00", "2026-W54", "2026-W99", "26-W01", "2026W01", "", null, "../etc"])
    assert.equal(weekFromLabel(bad), null, `${bad} must not resolve`);
});

test("2026 has 53 weeks and 2025 does not", () => {
  // A year has 53 ISO weeks only when the arithmetic lands back inside it.
  assert.notEqual(weekFromLabel("2026-W53"), null, "2026 has a week 53");
  assert.equal(weekFromLabel("2025-W53"), null, "2025 does not");
});

test("observed weeks are contiguous, newest first, and all resolvable", () => {
  const weeks = weeksObserved();
  assert.ok(weeks.length > 0, "the record has at least one week in it");

  for (const w of weeks) assert.notEqual(weekFromLabel(w), null, `${w} must resolve`);

  for (let i = 1; i < weeks.length; i += 1) {
    const newer = weekFromLabel(weeks[i - 1]);
    const older = weekFromLabel(weeks[i]);
    assert.ok(newer > older, "newest first");
    assert.equal(newer - older, 7 * DAY, "no week is skipped, including quiet ones");
  }
});

test("a withdrawn finding's headline never appears in a weekly report", () => {
  // This page printed rejected titles while the paragraph beneath them claimed it
  // never did, and on 27 July the two met: a finding was withdrawn under Article
  // IX for making a crawler the subject of its headline, and this page was ready
  // to reprint that headline verbatim under the word "rejected".
  //
  // The integrity check could not have caught it. It reads findings whose status
  // is 'published', and a withdrawn sentence resurfacing on a different page is
  // outside what it looks at. A crawler reads the sentence, not the label above it.
  for (const label of weeksObserved()) {
    const report = weeklyReport(label);
    if (report.rejected.length === 0) continue;

    const html = weeklyPage(label, "asd-test-marker", "2026-07-27T12:00:00.000Z");

    for (const finding of report.rejected) {
      assert.ok(
        !html.includes(finding.title),
        `${label} reprints a withdrawn headline: "${finding.title}"`
      );
      assert.ok(
        !html.includes(finding.slug),
        `${label} links a withdrawn finding: ${finding.slug}`
      );
    }
  }
});

test("a published finding brings its summary into the week", () => {
  // A list of titles is a table of contents. The week has to say what was learned,
  // and it has to do it without anybody writing a digest — so the finding's own
  // sentence is what appears.
  for (const label of weeksObserved()) {
    const report = weeklyReport(label);
    if (report.published.length === 0) continue;

    const html = weeklyPage(label, "asd-test-marker", "2026-07-27T12:00:00.000Z");

    for (const finding of report.published) {
      assert.ok(html.includes(finding.slug), `${label} omits ${finding.slug}`);
      if (finding.summary) {
        assert.ok(
          html.includes(escapeHtml(finding.summary)),
          `${label} lists "${finding.title}" without saying what it found`
        );
      }
    }
  }
});
