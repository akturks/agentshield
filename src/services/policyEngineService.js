function evaluatePolicy(risk) {
  if (
    risk.riskScore >= 90
  ) {
    return {
      policyId:
        "critical_risk_policy"
    };
  }

  if (
    risk.riskScore >= 70
  ) {
    return {
      policyId:
        "high_risk_policy"
    };
  }

  if (
    risk.riskScore >= 50
  ) {
    return {
      policyId:
        "medium_risk_policy"
    };
  }

  return {
    policyId:
      "low_risk_policy"
  };
}

export {
  evaluatePolicy
};
