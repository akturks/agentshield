function enforce(policy, allocation) {
  const actions = [];

  let enforcementLevel =
    "none";

  if (
    allocation.recommendedAction ===
    "adaptive_friction"
  ) {
    enforcementLevel =
      "light";

    actions.push(
      "exclude_from_analytics"
    );

    actions.push(
      "apply_rate_shaping"
    );
  }

  if (
    allocation.recommendedAction ===
    "challenge"
  ) {
    enforcementLevel =
      "strong";

    actions.push(
      "exclude_from_analytics"
    );

    actions.push(
      "strict_rate_limit"
    );
  }

  return {
    enforcementLevel,
    actions
  };
}

export {
  enforce
};
