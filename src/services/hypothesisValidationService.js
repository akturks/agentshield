
export function validateHypotheses(
  hypotheses
) {

  return hypotheses.map(
    hypothesis => ({

      hypothesisId:
        hypothesis.hypothesisId,

      supportLevel:
        0,

      contradictionLevel:
        0,

      evidenceCount:
        0,

      validationStatus:
        "pending"

    })
  );

}
