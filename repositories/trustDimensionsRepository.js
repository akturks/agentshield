export function calculateTrustDimensions({
  signals,
  eventCount
}) {
  let securityTrust = 100;
  let operationalTrust = 50;
  let reputationTrust = 50;
  let transactionTrust = 50;

  if (
    signals.includes(
      "admin_scanning"
    )
  ) {
    securityTrust -= 70;
  }

  operationalTrust =
    Math.min(
      50 + eventCount * 5,
      100
    );

  reputationTrust =
    Math.min(
      50 + eventCount * 2,
      100
    );

  return {
    securityTrust,
    operationalTrust,
    reputationTrust,
    transactionTrust
  };
}
