export function calculateConfidence({
  signals,
  evidence
}) {
  if (
    signals.includes(
      "admin_scanning"
    )
  ) {
    const count =
      evidence.admin_scanning
        ?.length || 0;

    return Math.min(
      0.5 + count * 0.1,
      0.99
    );
  }

  return 0.5;
}
