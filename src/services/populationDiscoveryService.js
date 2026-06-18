export function discoverPopulationPatterns(
  archives
) {

  const discoveries = [];

  const observerCount =
    archives.filter(
      archive =>
        archive.characterization?.character ===
        "Observer"
    ).length;

  if (observerCount >= 3) {

    discoveries.push({
      discoveryId:
        "DISC-POP-001",

      candidate:
        "Observer population cluster",

      occurrenceCount:
        observerCount,

      confidence:
        0.6,

      status:
        "pending"
    });

  }

  return discoveries;
}
