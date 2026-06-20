export function validateHypotheses(
  hypotheses,
  correlations
) {

  return hypotheses.map(
    hypothesis => {

      const correlation =
        correlations.find(
          item =>
            item.relationship ===
            hypothesis.statement
        );

      if (!correlation) {

        return {
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
        };

      }

      return {
        hypothesisId:
          hypothesis.hypothesisId,

        supportLevel:
          correlation.strength,

        contradictionLevel:
          1 -
          correlation.strength,

        evidenceCount:
          1,

        validationStatus:
          correlation.strength >=
          0.7
            ? "supported"
            : "pending"
      };

    }
  );

}
