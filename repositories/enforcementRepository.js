export function determineEnforcement({
  policyDecision,
  enforcementMode = "observe"
}) {
  if (
    enforcementMode ===
    "observe"
  ) {
    return {
      enforcementMode,
      action: "log_only"
    };
  }

  if (
    enforcementMode ===
    "shadow"
  ) {
    return {
      enforcementMode,
      action: "report_only"
    };
  }

  return {
    enforcementMode:
      "active",

    action:
      policyDecision
  };
}
