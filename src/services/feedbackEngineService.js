function generateFeedback(outcome) {
  let trustAdjustment = 0;

  if (
    outcome.outcome ===
    "traffic_reduced"
  ) {
    trustAdjustment = 5;
  }

  if (
    outcome.outcome ===
    "abuse_contained"
  ) {
    trustAdjustment = 10;
  }

  return {
    trustAdjustment
  };
}

export {
  generateFeedback
};
