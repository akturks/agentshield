export function collectEvidence(
  hypotheses
) {

  return hypotheses.map(
    hypothesis => ({

      evidenceId:
        `EVID-${hypothesis.hypothesisId}`,

      hypothesisId:
        hypothesis.hypothesisId,

      evidenceType:
        "pending",

      source:
        "unknown",

      confidence:
        0

    })
  );

}
