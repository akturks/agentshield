export function deriveSignals(events) {
  const signals = [];

  const adminRequests =
    events.filter(
      event =>
        event.path &&
        event.path.includes("/admin")
    );

  if (adminRequests.length >= 3) {
    signals.push("admin_scanning");
  }

  return signals;
}
