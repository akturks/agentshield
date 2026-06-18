export function discoverBehavior({
  patterns,
  characterization
}) {

  const discoveries = [];

  if (
    characterization?.character ===
    "Observer"
  ) {

    const hasRepeatActivity =
      patterns.some(
        pattern =>
          pattern.pattern ===
          "repeat_activity"
      );

    if (hasRepeatActivity) {

      discoveries.push({
        discoveryId:
          "DISC-001",

        candidate:
          "repeat_activity ↔ Observer",

        confidence:
          0.7,

        status:
          "pending"
      });

    }

  }

  return discoveries;
}
