function calculateRiskLevel(riskScore) {
  if (riskScore >= 80) {
    return "critical";
  }

  if (riskScore >= 60) {
    return "high";
  }

  if (riskScore >= 40) {
    return "medium";
  }

  return "low";
}

function classify(profile) {
  let riskScore = 100 - profile.currentTrustScore;

  const reasons = [];

  if (profile.currentTrustScore < 40) {
    reasons.push("low_trust_score");
  }

  if (profile.trend === "declining") {
    riskScore += 15;
    reasons.push("negative_trust_trend");
  }

  if (profile.trend === "rapid_decline") {
    riskScore += 30;
    reasons.push("rapid_trust_decline");
  }

  riskScore = Math.max(0, Math.min(100, riskScore));

  return {
    riskScore,
    riskLevel: calculateRiskLevel(riskScore),
    trustScore: profile.currentTrustScore,
    trend: profile.trend,
    reasons
  };
}

export {
  classify
};
