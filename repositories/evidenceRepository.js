export function deriveEvidence(events) {
  const evidence = {};

  const adminEvents =
    events.filter(
      (event) =>
        event.path?.includes("/admin")
    );

  if (adminEvents.length >= 3) {
    evidence.admin_scanning =
      adminEvents.map(
        (event) => event.id
      );
  }

  return evidence;
}
