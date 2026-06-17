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

function learnFromCharacter(
  characterization
) {
  if (
    !characterization
  ) {
    return null;
  }

  const {
    character,
    confidence
  } = characterization;

  let learning =
    "insufficient_data";

  if (
    character ===
      "Observer" &&
    confidence >= 0.7
  ) {
    learning =
      "repeat_observation_detected";
  }

  if (
    character ===
      "Explorer" &&
    confidence >= 0.8
  ) {
    learning =
      "active_exploration_detected";
  }

  if (
    character ===
      "Researcher" &&
    confidence >= 0.8
  ) {
    learning =
      "research_behavior_detected";
  }

  return {
    learning,
    confidence
  };
}

export {
  evaluateLearning,
  learnFromCharacter
};
