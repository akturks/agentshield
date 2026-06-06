function allocate(risk) {
  const reasons = [];

  let resourceTier =
    "standard";

  let recommendedAction =
    "allow";

  let analyticsExcluded =
    false;

  if (risk.riskScore >= 90) {
    resourceTier =
      "restricted";

    recommendedAction =
      "challenge";

    analyticsExcluded =
      true;

    reasons.push(
      "critical_risk"
    );
  } else if (
    risk.riskScore >= 70
  ) {
    resourceTier =
      "restricted";

    recommendedAction =
      "adaptive_friction";

    analyticsExcluded =
      true;

    reasons.push(
      "high_risk"
    );
  } else if (
    risk.riskScore >= 50
  ) {
    resourceTier =
      "observed";

    recommendedAction =
      "observe";

    reasons.push(
      "medium_risk"
    );
  } else {
    resourceTier =
      "standard";

    recommendedAction =
      "allow";

    reasons.push(
      "low_risk"
    );
  }

  return {
    resourceTier,
    recommendedAction,
    analyticsExcluded,
    reasons
  };
}

export {
  allocate
};
