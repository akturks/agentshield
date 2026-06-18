export function calculateCorrelations(
  archives
) {

  const correlations = [];

  const observerArchives =
    archives.filter(
      archive =>
        archive.characterization?.character ===
        "Observer"
    );

  const repeatActivityCount =
    observerArchives.filter(
      archive =>
        archive.patterns?.some(
          pattern =>
            pattern.pattern ===
            "repeat_activity"
        )
    ).length;

  if (
    observerArchives.length > 0
  ) {

    correlations.push({
      relationship:
        "Observer ↔ repeat_activity",

      population:
        observerArchives.length,

      occurrences:
        repeatActivityCount,

      strength:
        repeatActivityCount /
        observerArchives.length
    });

  }

  return correlations;
}
