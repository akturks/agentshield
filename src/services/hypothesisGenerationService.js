export function generateHypotheses(
  discoveries
) {

  return discoveries.map(
    discovery => ({

      hypothesisId:
        `HYP-${discovery.discoveryId}`,

      statement:
        discovery.candidate,

      confidence:
        discovery.confidence,

      sourceDiscovery:
        discovery.discoveryId,

      status:
        "unvalidated"

    })
  );

}
