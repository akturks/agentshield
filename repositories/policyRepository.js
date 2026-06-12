export function makeDecision({
  trustScore,
  intent
}) {

  if (
    intent === "reconnaissance" &&
    trustScore < 20
  ) {
    return "THROTTLE";
  }

  if (
    intent === "reconnaissance" &&
    trustScore < 40
  ) {
    return "CHALLENGE";
  }

  if (
    trustScore < 60
  ) {
    return "OBSERVE";
  }

  return "ALLOW";
}
