export function discoverPatterns(
  history
) {
  if (!history) {
    return [];
  }

  const patterns = [];

  if (
    history.readingTime.average >= 30
  ) {
    patterns.push({
      pattern:
        "long_form_consumption",

      confidence: 0.8
    });
  }

  if (
    history.mouseMoves.average >= 30
  ) {
    patterns.push({
      pattern:
        "high_interaction",

      confidence: 0.7
    });
  }

  if (
    history.scrollDepth.average >= 50
  ) {
    patterns.push({
      pattern:
        "deep_navigation",

      confidence: 0.7
    });
  }

  if (
    history.eventCount >= 5
  ) {
    patterns.push({
      pattern:
        "repeat_activity",

      confidence: 0.9
    });
  }

  return patterns;
}
