export function learnFromCharacter(
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
