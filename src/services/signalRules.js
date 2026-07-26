// One rule per behavioural signal, in one place.
//
// Signals and their evidence used to be derived by two separate functions that
// each restated the same thresholds. They disagreed, and the disagreement was
// silent: deriveSignals covered five signals while deriveEvidence covered one, so
// four of the five adjustments the trust score makes had no recorded basis. On
// 2026-07-26, 33 of 36 stored assessments could not be recomputed for this
// reason — the newest sixteen all carried an empty evidence object.
//
// The Constitution's Independent Validation article says a conclusion must be
// checkable against something that did not produce it. A signal whose supporting
// events were never recorded fails that at the point of writing, not later. So a
// signal is defined here together with the predicate that selects the events
// supporting it, and both derivations read this table. A signal cannot now exist
// without its evidence, because the same rule produces both.

/**
 * `supports` selects the events that back the signal. `minEvents` is how many
 * such events the signal requires before it is asserted at all.
 */
export const SIGNAL_RULES = [
  {
    name: "admin_scanning",
    minEvents: 3,
    supports: (event) => Boolean(event.path && event.path.includes("/admin"))
  },
  {
    name: "engaged_reading",
    minEvents: 1,
    supports: (event) => (event.readingTime || 0) >= 10
  },
  {
    name: "deep_scroll",
    minEvents: 1,
    supports: (event) => (event.scrollDepth || 0) >= 50
  },
  {
    name: "active_mouse",
    minEvents: 1,
    supports: (event) => (event.mouseMoves || 0) >= 10
  },
  {
    name: "focused_session",
    minEvents: 1,
    supports: (event) => (event.focusEvents || 0) >= 1
  }
];

/**
 * Which signals these events assert, and the event ids behind each one.
 *
 * Returned together on purpose. A caller that wanted only the names could drop
 * the ids, but it cannot get the names without the ids having been computed —
 * which is the property that was missing.
 */
export function applySignalRules(events) {
  const asserted = [];
  const supportingEvents = {};

  for (const rule of SIGNAL_RULES) {
    const matching = events.filter(rule.supports);
    if (matching.length < rule.minEvents) continue;

    asserted.push(rule.name);
    supportingEvents[rule.name] = matching.map((event) => event.id);
  }

  return { signals: asserted, evidence: supportingEvents };
}
