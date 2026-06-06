function applyTrustUpdate(
  trustScore,
  feedback
) {
  const updatedTrustScore =
    Math.max(
      0,
      Math.min(
        100,
        trustScore +
          feedback.trustAdjustment
      )
    );

  return {
    previousTrustScore:
      trustScore,

    updatedTrustScore,

    adjustment:
      feedback.trustAdjustment
  };
}

export {
  applyTrustUpdate
};
