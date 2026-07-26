import { applySignalRules } from "./signalRules.js";

// Which signals a set of events asserts.
//
// The thresholds used to live here as five hand-written filters, duplicated in
// evidenceDerivationService.js with only one of the five implemented. They are now
// declared once in signalRules.js so that a signal and the events supporting it
// cannot disagree.

export function deriveSignals(events) {
  return applySignalRules(events).signals;
}
