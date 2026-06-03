export function makeDecision({
  trustScore,
  intent
}) {
  if (
    intent === "reconnaissance" &&
    trustScore < 40
  ) {
    return "challenge";
  }

  return "allow";
}
