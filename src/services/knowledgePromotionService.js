export function promoteKnowledge(
  validations
) {

  return validations
    .filter(
      validation =>
        validation.validationStatus ===
        "supported"
    )
    .map(
      validation => ({


        knowledgeId:
          `KNOW-${validation.hypothesisId}`,

        statement:
          validation.statement,

        sourceHypothesis:
          validation.hypothesisId,

        confidence:
          validation.supportLevel,

        evidenceCount:
          validation.evidenceCount,

        status:
          "accepted"

      })
    );

}
