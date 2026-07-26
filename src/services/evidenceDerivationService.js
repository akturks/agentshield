import { applySignalRules } from "./signalRules.js";

// The events behind each asserted signal, keyed by signal name.
//
// This function previously derived evidence for admin_scanning and nothing else,
// while the trust score adjusted itself on five signals. The four unevidenced
// adjustments were not wrong so much as unreviewable: an assessment stating
// "trust 57, because engaged_reading" recorded no way to find out which events
// were read as engaged reading, so it could never be re-derived and therefore
// could never be shown to be mistaken.
//
// Every signal in signalRules.js now yields its supporting event ids. Events may
// appear under more than one signal — a single request can be both deep_scroll and
// active_mouse — because these are the events supporting each claim, not a
// partition of the record.

export function deriveEvidence(events) {
  return applySignalRules(events).evidence;
}
