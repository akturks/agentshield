function evaluateLearning(
  outcome
) {
  let learningSignal =
    "unknown";

  let confidence =
    0.1;

  if (
    outcome.outcome ===
    "traffic_reduced"
  ) {
    learningSignal =
      "possible_positive_effect";

    confidence =
      0.3;
  }

  if (
    outcome.outcome ===
    "abuse_contained"
  ) {
    learningSignal =
      "confirmed_positive_effect";

    confidence =
      0.8;
  }

  return {
    learningSignal,
    confidence
  };
}

export {
  evaluateLearning
};
