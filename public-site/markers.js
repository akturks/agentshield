import db from "./realityDb.js";
import { EXTERNAL } from "./stats.js";

// What has actually happened to each published marker.
//
// The lab listed markers with a publication instant and an empty column headed
// "first observed in a model", which is honest and says almost nothing. It gives
// a reader two states — published, and the thing that has never happened — with
// no way to tell a marker that has been served to forty crawlers from one that
// nothing has ever collected. Those are very different positions to be in while
// waiting, and the site's central measurement is the wait.
//
// So the middle of the lifecycle is recorded here. The capture hook already
// stamps each request with the marker it was served, which means delivery is a
// fact in the record rather than an inference from paths and timestamps.
//
// Three states, not four. "Created" and "published" are the same instant in this
// system — a token is minted and served — and inventing a distinction the data
// does not hold would be exactly the decoration this site refuses.
//
// One distinction is worth the extra column: a 304 carries no body. A client that
// sends a conditional request and is told nothing changed did not receive the
// marker on that visit, however plainly it asked for the page. Counting it as a
// delivery would report a marker as reaching a client it never reached.

const lifecycle = db.prepare(`
  SELECT
    c.token,
    c.page,
    c.publishedAt,
    (SELECT COUNT(*) FROM RequestReality r
      WHERE r.canaryToken = c.token AND r.responseStatus = 200 AND ${EXTERNAL}) AS delivered,
    (SELECT COUNT(*) FROM RequestReality r
      WHERE r.canaryToken = c.token AND r.responseStatus = 304 AND ${EXTERNAL}) AS notModified,
    (SELECT COUNT(DISTINCT r.userAgent) FROM RequestReality r
      WHERE r.canaryToken = c.token AND r.responseStatus = 200 AND ${EXTERNAL}) AS agents,
    (SELECT MAX(r.observedAt) FROM RequestReality r
      WHERE r.canaryToken = c.token AND r.responseStatus = 200 AND ${EXTERNAL}) AS lastDelivered
  FROM CanaryToken c
  ORDER BY delivered DESC, c.publishedAt
`);

/**
 * Every marker, with what the record says has happened to it.
 *
 * `seenInModel` is not queried. No marker has ever been observed in a language
 * model's output, and there is no store of such observations to read — the
 * absence is stated as a constant here rather than dressed as a lookup that
 * happens to return nothing.
 */
export function markerLifecycle() {
  const rows = lifecycle.all();

  return {
    markers: rows,
    total: rows.length,
    everDelivered: rows.filter((r) => r.delivered > 0).length,
    neverDelivered: rows.filter((r) => r.delivered === 0).length,
    deliveries: rows.reduce((sum, r) => sum + r.delivered, 0),
    seenInModel: 0
  };
}

/** The state a single marker is in, for a label. */
export function markerState(row) {
  if (row.delivered > 0) return "delivered";
  return "published";
}
