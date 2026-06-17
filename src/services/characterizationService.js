export function characterizePatterns(
  patterns
) {
  if (
    !patterns ||
    patterns.length === 0
  ) {
    return {
      character:
        "Unknown",

      confidence: 0.1,

      evidence: []
    };
  }

  const names =
    patterns.map(
      pattern =>
        pattern.pattern
    );

  let character =
    "Observer";

  let confidence =
    0.5;

  if (
    names.includes(
      "long_form_consumption"
    ) &&
    names.includes(
      "deep_navigation"
    )
  ) {
    character =
      "Researcher";

    confidence =
      0.85;
  }

  else if (
    names.includes(
      "high_interaction"
    ) &&
    names.includes(
      "repeat_activity"
    )
  ) {
    character =
      "Explorer";

    confidence =
      0.80;
  }

  else if (
    names.includes(
      "repeat_activity"
    )
  ) {
    character =
      "Observer";

    confidence =
      0.70;
  }

  return {
    character,
    confidence,
    evidence:
      names
  };
}
