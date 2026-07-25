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

  const readingEvents =
    events.filter(
      event =>
        (event.readingTime || 0) >= 10
    );

  if (readingEvents.length > 0) {
    signals.push(
      "engaged_reading"
    );
  }

  const deepScrollEvents =
    events.filter(
      event =>
        (event.scrollDepth || 0) >= 50
    );

  if (deepScrollEvents.length > 0) {
    signals.push(
      "deep_scroll"
    );
  }

  const activeMouseEvents =
    events.filter(
      event =>
        (event.mouseMoves || 0) >= 10
    );

  if (activeMouseEvents.length > 0) {
    signals.push(
      "active_mouse"
    );
  }

  const focusedEvents =
    events.filter(
      event =>
        (event.focusEvents || 0) >= 1
    );

  if (focusedEvents.length > 0) {
    signals.push(
      "focused_session"
    );
  }

  return signals;
}
