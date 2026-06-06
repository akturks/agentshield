function evaluateOutcome(enforcement) {
  let outcome =
    "unknown";

  let confidence =
    "low";

  if (
    enforcement.actions.includes(
      "apply_rate_shaping"
    )
  ) {
    outcome =
      "traffic_reduced";

    confidence =
      "medium";
  }

  if (
    enforcement.actions.includes(
      "strict_rate_limit"
    )
  ) {
    outcome =
      "abuse_contained";

    confidence =
      "high";
  }

  return {
    outcome,
    confidence
  };
}

export {
  evaluateOutcome
};
