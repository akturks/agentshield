import test from "node:test";
import assert from "node:assert/strict";

import db from "../../public-site/realityDb.js";
import { markerLifecycle } from "../../public-site/markers.js";

// The marker lifecycle is the site's central measurement made legible, so the
// ways it could quietly mislead are worth pinning down. A marker counted as
// delivered when the client received no body would report the experiment as
// running on a page nothing has ever collected — which is the one thing this
// table was added to make visible.

test("every published marker appears exactly once", () => {
  const { markers, total } = markerLifecycle();
  const stored = db.prepare("SELECT COUNT(*) AS n FROM CanaryToken").get().n;

  assert.equal(total, stored, "the table must account for every minted marker");
  assert.equal(new Set(markers.map((m) => m.token)).size, total, "no marker listed twice");
});

test("a 304 is never counted as a delivery", () => {
  // A conditional request answered "not modified" carries no body, so the marker
  // did not reach that client on that visit however plainly it asked.
  const { markers } = markerLifecycle();

  for (const m of markers) {
    const bodies = db
      .prepare(
        "SELECT COUNT(*) AS n FROM RequestReality WHERE canaryToken = ? AND responseStatus = 200"
      )
      .get(m.token).n;

    assert.ok(
      m.delivered <= bodies,
      `${m.page} reports ${m.delivered} deliveries against ${bodies} responses that carried a body`
    );
  }
});

test("delivered and never-delivered partition the set", () => {
  const { markers, total, everDelivered, neverDelivered, deliveries } = markerLifecycle();

  assert.equal(everDelivered + neverDelivered, total, "every marker is in one state or the other");
  assert.equal(
    deliveries,
    markers.reduce((sum, m) => sum + m.delivered, 0),
    "the total must be the sum of the rows a reader can see"
  );
  assert.equal(
    neverDelivered,
    markers.filter((m) => m.delivered === 0).length,
    "the count and the rows must agree"
  );
});

test("no marker has been observed in a model, and the figure is stated not queried", () => {
  // There is no store of such observations to read. The absence is a constant
  // here rather than a lookup that happens to return nothing, because a lookup
  // would one day return nothing for the wrong reason and nobody would notice.
  assert.equal(markerLifecycle().seenInModel, 0);
});

test("a delivery count never exceeds the requests that carried the marker", () => {
  const { markers } = markerLifecycle();

  for (const m of markers) {
    const carried = db
      .prepare("SELECT COUNT(*) AS n FROM RequestReality WHERE canaryToken = ?")
      .get(m.token).n;

    assert.ok(
      m.delivered + m.notModified <= carried,
      `${m.page}: ${m.delivered} + ${m.notModified} exceeds the ${carried} requests stamped with this marker`
    );
    assert.ok(m.agents <= m.delivered, `${m.page} reports more agents than deliveries`);
  }
});
