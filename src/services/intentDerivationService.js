export function deriveIntent(signals) {
  if (
    signals.includes(
      "admin_scanning"
    )
  ) {
    return "reconnaissance";
  }

  return "unknown";
}
